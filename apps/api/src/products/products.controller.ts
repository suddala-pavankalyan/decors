import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductsDto } from './query-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: QueryProductsDto) {
    return this.products.search(query);
  }

  @Get('facets')
  facets() {
    return this.products.facets();
  }
}
