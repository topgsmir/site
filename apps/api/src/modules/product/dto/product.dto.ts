import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { BridgeProductBindingDto } from "../../bridge/dto/bridge.dto";

export const productKinds = ["simple", "variable"] as const;
export const productTypes = ["digital", "physical", "service", "bridge"] as const;
export const productStatuses = ["draft", "pending_review", "active", "archived"] as const;
export const listingStatuses = ["draft", "active", "archived"] as const;

type ProductKind = (typeof productKinds)[number];
type ProductType = (typeof productTypes)[number];
type ProductStatus = (typeof productStatuses)[number];
type ListingStatus = (typeof listingStatuses)[number];

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const STORAGE_REFERENCE_PATTERN =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;

export class ListProductsQueryDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ProductVariantOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value!: string;
}

export class CreateProductVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique((option: ProductVariantOptionDto) =>
    typeof option?.name === "string"
      ? option.name.trim().toLowerCase()
      : option?.name
  )
  @ValidateNested({ each: true })
  @Type(() => ProductVariantOptionDto)
  options!: ProductVariantOptionDto[];
}

export class DigitalFulfillmentDto {
  @IsString()
  @Matches(STORAGE_REFERENCE_PATTERN)
  fileReference!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  maxDownloads!: number;
}

export class PhysicalFulfillmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  stock!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  weightGrams!: number;
}

export class ServiceFulfillmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serviceType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedHours!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  instructions?: string;
}

class SellerOfferFieldsDto {
  @IsString()
  @Matches(MONEY_PATTERN)
  price!: string;

  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sellerSku?: string;

  @IsOptional()
  @IsIn(listingStatuses)
  status?: ListingStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => DigitalFulfillmentDto)
  digital?: DigitalFulfillmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhysicalFulfillmentDto)
  physical?: PhysicalFulfillmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceFulfillmentDto)
  service?: ServiceFulfillmentDto;
}

export class CreateProductOfferDto extends SellerOfferFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  variantKey?: string;
}

export class AddSellerOfferDto extends SellerOfferFieldsDto {
  @IsUUID("4")
  variantId!: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category?: string;

  @IsIn(productKinds)
  kind!: ProductKind;

  @IsIn(productTypes)
  type!: ProductType;

  @IsOptional()
  @IsIn(productStatuses)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((variant: CreateProductVariantDto) =>
    typeof variant?.key === "string" ? variant.key.trim() : variant?.key
  )
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BridgeProductBindingDto)
  bridge?: BridgeProductBindingDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProductOfferDto)
  offers!: CreateProductOfferDto[];
}

export class AddSellerOffersDto {
  @IsOptional()
  @IsIn(listingStatuses)
  listingStatus?: ListingStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((offer: AddSellerOfferDto) => offer?.variantId)
  @ValidateNested({ each: true })
  @Type(() => AddSellerOfferDto)
  offers!: AddSellerOfferDto[];
}

export class UpdateSellerOfferDto {
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  price?: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sellerSku?: string;

  @IsOptional()
  @IsIn(listingStatuses)
  status?: ListingStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => DigitalFulfillmentDto)
  digital?: DigitalFulfillmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhysicalFulfillmentDto)
  physical?: PhysicalFulfillmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceFulfillmentDto)
  service?: ServiceFulfillmentDto;
}

export class ReviewProductDto {
  @IsIn(["active", "draft"])
  status!: "active" | "draft";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
