import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fromEnum, toEnum } from '../products/category';
import { ImageStorage } from '../uploads/image-storage';
import { publicUrl } from '../uploads/public-url';
import { ProductInputDto } from './admin.dto';

export const MAX_IMAGES = 8;

const include = {
  color: true,
  tags: true,
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;

const toAdminDto = (r: Row) => ({
  id: r.id,
  name: r.name,
  category: fromEnum(r.category),
  price: r.price,
  rating: r.rating,
  description: r.description,
  colorName: r.color.name,
  colorHex: r.color.hex,
  tags: r.tags.map((t) => t.name).sort(),
  images: r.images.map((i) => ({ id: i.id, url: publicUrl(i.url), alt: i.alt })),
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly storage: ImageStorage) {}

  async list() {
    const rows = await this.prisma.product.findMany({ include, orderBy: { createdAt: 'desc' } });
    return { total: rows.length, items: rows.map(toAdminDto) };
  }

  async get(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Product not found');
    return toAdminDto(row);
  }

  async create(dto: ProductInputDto) {
    const colorId = await this.resolveColor(dto.colorName, dto.colorHex);
    const row = await this.prisma.product.create({
      data: {
        name: dto.name, category: toEnum(dto.category), price: dto.price, rating: dto.rating,
        description: dto.description, colorId,
        tags: { connectOrCreate: dto.tags.map((name) => ({ where: { name }, create: { name } })) },
      },
      include,
    });
    return toAdminDto(row);
  }

  async update(id: string, dto: ProductInputDto) {
    await this.mustExist(id);
    const colorId = await this.resolveColor(dto.colorName, dto.colorHex);
    const [, row] = await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { tags: { set: [] } } }),
      this.prisma.product.update({
        where: { id },
        data: {
          name: dto.name, category: toEnum(dto.category), price: dto.price, rating: dto.rating,
          description: dto.description, colorId,
          tags: { connectOrCreate: dto.tags.map((name) => ({ where: { name }, create: { name } })) },
        },
        include,
      }),
    ]);
    return toAdminDto(row);
  }

  /** Cart/wishlist rows go with the product; past orders keep their name/price snapshot. */
  async remove(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!row) throw new NotFoundException('Product not found');
    await this.prisma.product.delete({ where: { id } });
    await Promise.all(row.images.map((i) => this.storage.remove(i.url)));
  }

  async addImage(productId: string, file: Express.Multer.File | undefined, alt?: string) {
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    const product = await this.prisma.product.findUnique({
      where: { id: productId }, include: { images: { select: { position: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.images.length >= MAX_IMAGES) {
      throw new BadRequestException(`A product can have at most ${MAX_IMAGES} images`);
    }
    const url = await this.storage.save(file.buffer);
    try {
      const position = product.images.reduce((m, i) => Math.max(m, i.position), -1) + 1;
      await this.prisma.productImage.create({
        data: { productId, url, position, alt: alt?.trim() || `${product.name} – photo ${position + 1}` },
      });
    } catch (e) {
      await this.storage.remove(url); // don't leave an orphan file if the row couldn't be saved
      throw e;
    }
    return this.get(productId);
  }

  async removeImage(productId: string, imageId: number) {
    const img = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!img) throw new NotFoundException('Image not found');
    await this.prisma.productImage.delete({ where: { id: img.id } });
    await this.storage.remove(img.url);
    return this.get(productId);
  }

  /** `ids` must be exactly this product's image ids, in the desired order (first = main photo). */
  async reorderImages(productId: string, ids: number[]) {
    await this.mustExist(productId);
    const current = await this.prisma.productImage.findMany({ where: { productId }, select: { id: true } });
    const same = ids.length === current.length && new Set(ids).size === ids.length && current.every((c) => ids.includes(c.id));
    if (!same) throw new BadRequestException("ids must list each of the product's images exactly once");
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.productImage.update({ where: { id }, data: { position } })),
    );
    return this.get(productId);
  }

  private async mustExist(id: string) {
    if (!(await this.prisma.product.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Product not found');
    }
  }

  /** Colours are shared by name. Reuse an existing one, but never silently change its hex for other products. */
  private async resolveColor(name: string, hex: string): Promise<number> {
    const existing = await this.prisma.color.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (existing) {
      if (existing.hex.toLowerCase() !== hex.toLowerCase()) {
        // Nobody uses it any more, so it's safe to give the name a new shade.
        if ((await this.prisma.product.count({ where: { colorId: existing.id } })) === 0) {
          await this.prisma.color.update({ where: { id: existing.id }, data: { hex: hex.toUpperCase() } });
          return existing.id;
        }
        throw new ConflictException(`Colour "${existing.name}" already exists as ${existing.hex}. Pick it from the list or use a different name.`);
      }
      return existing.id;
    }
    return (await this.prisma.color.create({ data: { name, hex: hex.toUpperCase() } })).id;
  }
}
