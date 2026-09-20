import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
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
const CURRENCY_PATTERN = /^(?:TOMAN|USD)$/;
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export class ListProductsQueryDto {
  @IsOptional()
  @IsIn(productTypes)
  type?: (typeof productTypes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
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
  sellerSku?: string | null;

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

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsIn(productStatuses)
  status?: ProductStatus;
}

export class ManageProductsQueryDto extends ListProductsQueryDto {
  @IsOptional()
  @IsIn(productStatuses)
  status?: ProductStatus;

  @IsOptional()
  @IsIn(productKinds)
  kind?: ProductKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsIn(["updated_desc", "updated_asc", "created_desc", "created_asc", "title_asc", "title_desc"])
  sort?: "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "title_asc" | "title_desc";
}

export class SellerProductsQueryDto extends ManageProductsQueryDto {
  @IsOptional()
  @IsIn(listingStatuses)
  listingStatus?: ListingStatus;
}

export class UpdateAdminProductDto extends UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(SLUG_PATTERN)
  slug?: string;
}

export class UpdateAdminListingDto {
  @IsIn(listingStatuses)
  status!: ListingStatus;
}

export class ReviewProductDto {
  @IsIn(["active", "draft"])
  status!: "active" | "draft";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RestoreProductChangeDto {
  @IsUUID("4")
  changeId!: string;

  @IsOptional()
  @IsIn(["before", "after"])
  side: "before" | "after" = "after";
}

export const productChangeActions = ["update", "review", "restore"] as const;

export class PreviewBulkUndoProductChangesDto {
  @IsIn(["last", "after_time"])
  mode!: "last" | "after_time";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count = 100;

  @IsOptional()
  @IsISO8601({ strict: true })
  after?: string;

  @IsOptional()
  @IsIn(["and", "or"])
  operator: "and" | "or" = "and";

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(productChangeActions, { each: true })
  actions?: Array<(typeof productChangeActions)[number]>;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsIn(productTypes, { each: true })
  productTypes?: ProductType[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  sellerIds?: string[];
}

export class BulkUndoProductChangesDto extends PreviewBulkUndoProductChangesDto {
  @IsUUID("4")
  operationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  changeIds!: string[];
}
