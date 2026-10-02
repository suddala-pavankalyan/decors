import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { include, toDto } from '../products/products.service';
import { MAX_QTY, MergeDto } from './account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async state(userId: string) {
    const [cart, wishlist] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { userId }, orderBy: { updatedAt: 'asc' }, include: { product: { include } },
      }),
      this.prisma.wishlistItem.findMany({
        where: { userId }, orderBy: { createdAt: 'asc' }, include: { product: { include } },
      }),
    ]);
    return {
      cart: cart.map((c) => ({ qty: c.qty, product: toDto(c.product) })),
      wishlist: wishlist.map((w) => toDto(w.product)),
    };
  }

  async setQty(userId: string, productId: string, qty: number) {
    if (qty === 0) {
      await this.prisma.cartItem.deleteMany({ where: { userId, productId } });
      return;
    }
    await this.guardProduct(() =>
      this.prisma.cartItem.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId, qty },
        update: { qty },
      }),
    );
  }

  clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId } });
  }

  async addWish(userId: string, productId: string) {
    await this.guardProduct(() =>
      this.prisma.wishlistItem.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: {},
      }),
    );
  }

  removeWish(userId: string, productId: string) {
    return this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }

  /** Fold a guest's local cart/wishlist into the account: quantities add (capped), wishlist unions. */
  async merge(userId: string, dto: MergeDto) {
    const ids = [...new Set([...dto.cart.map((l) => l.productId), ...dto.wishlist])];
    const known = new Set(
      (await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id),
    );
    const guest = new Map<string, number>();
    for (const l of dto.cart) {
      if (known.has(l.productId)) guest.set(l.productId, Math.min(MAX_QTY, (guest.get(l.productId) ?? 0) + l.qty));
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findMany({ where: { userId, productId: { in: [...guest.keys()] } } });
      const have = new Map(existing.map((e) => [e.productId, e.qty]));
      for (const [productId, qty] of guest) {
        const total = Math.min(MAX_QTY, (have.get(productId) ?? 0) + qty);
        await tx.cartItem.upsert({
          where: { userId_productId: { userId, productId } },
          create: { userId, productId, qty: total },
          update: { qty: total },
        });
      }
      await tx.wishlistItem.createMany({
        data: dto.wishlist.filter((id) => known.has(id)).map((productId) => ({ userId, productId })),
        skipDuplicates: true,
      });
    });
    return this.state(userId);
  }

  private async guardProduct<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new NotFoundException('Product not found');
      }
      throw e;
    }
  }
}
