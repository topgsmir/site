import { Body, Controller, Get, Param, Post } from "@nestjs/common";

type CreateProductDto = {
  sellerId: string;
  title: string;
  type: "digital" | "physical" | "service";
  price: number;
};

const products: Array<CreateProductDto & { id: string }> = [];

@Controller("products")
export class ProductController {
  @Get()
  list() {
    return products;
  }

  @Post()
  create(@Body() body: CreateProductDto) {
    const item = { ...body, id: `${Date.now()}` };
    products.push(item);
    return item;
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return products.find((item) => item.id === id) ?? null;
  }
}

