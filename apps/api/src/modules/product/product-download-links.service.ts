import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isAllowedUnsignedFileUrl } from "../order/upload-download-link";
import type { DownloadLinkDto, ReplaceDownloadLinksDto, RequestDownloadLinkChangeDto, ReviewDownloadLinkChangeDto } from "./dto/download-link.dto";

const digitalSelect = {
  id: true,
  listing: { select: { seller_id: true, product: { select: { type: true } } } },
  digital: { select: { file_reference: true, file_references: true, file_titles: true, max_downloads: true } }
} satisfies Prisma.seller_offersSelect;

@Injectable()
export class ProductDownloadLinksService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private async write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        throw new ConflictException("Download links changed during editing; reload and try again");
      }
      throw error;
    }
  }

  private validateUrls(urls: string[]) {
    const hosts = this.config.get<string>("UPLOAD_DOWNLOAD_HOSTS") ?? "";
    if (!hosts || !urls.every((url) => isAllowedUnsignedFileUrl(url, hosts))) {
      throw new BadRequestException("Download links must be unsigned HTTPS file URLs on a configured upload host");
    }
  }

  private links(offer: { digital: { file_reference: string; file_references: string[]; file_titles: string[] } | null }) {
    if (!offer.digital) throw new BadRequestException("This is not a digital offer");
    const urls = offer.digital.file_references.length ? offer.digital.file_references : [offer.digital.file_reference];
    return { urls, titles: urls.map((_, index) => offer.digital!.file_titles[index] ?? "") };
  }

  private async offer(tx: Prisma.TransactionClient, offerId: string, sellerId?: string) {
    const offer = await tx.seller_offers.findFirst({
      where: { id: offerId, ...(sellerId ? { listing: { seller_id: sellerId } } : {}) },
      select: digitalSelect
    });
    if (!offer) throw new NotFoundException("Digital offer was not found");
    if (offer.listing.product.type !== "digital" || !offer.digital) throw new BadRequestException("This is not a digital offer");
    return offer;
  }

  private async save(tx: Prisma.TransactionClient, offerId: string, urls: string[], titles: string[]) {
    await tx.seller_offer_digital.update({
      where: { offer_id: offerId },
      data: { file_reference: urls[0]!, file_references: urls, file_titles: titles }
    });
    return { fileReferences: urls, fileTitles: titles };
  }

  private async audit(tx: Prisma.TransactionClient, input: {
    offerId: string; actorId: string; action: "admin_replace" | "seller_add" | "approved_edit" | "approved_delete";
    before: { urls: string[]; titles: string[] }; after: { urls: string[]; titles: string[] }; requestId?: string;
  }) {
    await tx.download_link_change_events.create({ data: {
      offer_id: input.offerId, actor_user_id: input.actorId, action: input.action,
      request_id: input.requestId ?? null,
      before_urls: input.before.urls, before_titles: input.before.titles,
      after_urls: input.after.urls, after_titles: input.after.titles
    } });
  }

  async replaceAsAdmin(offerId: string, actorId: string, input: ReplaceDownloadLinksDto) {
    if (input.fileReferences.length !== input.fileTitles.length) throw new BadRequestException("Each download URL needs a title");
    this.validateUrls(input.fileReferences);
    const titles = input.fileTitles.map((title) => title.trim());
    if (titles.some((title) => !title)) throw new BadRequestException("Each download URL needs a title");
    return this.write(async (tx) => {
      const offer = await this.offer(tx, offerId);
      const before = this.links(offer);
      const result = await this.save(tx, offerId, input.fileReferences, titles);
      await this.audit(tx, { offerId, actorId, action: "admin_replace", before, after: { urls: result.fileReferences, titles: result.fileTitles } });
      return result;
    });
  }

  async addAsSeller(sellerId: string, actorId: string, offerId: string, input: DownloadLinkDto) {
    this.validateUrls([input.url]);
    const title = input.title.trim();
    if (!title) throw new BadRequestException("A download link title is required");
    return this.write(async (tx) => {
      const offer = await this.offer(tx, offerId, sellerId);
      const { urls, titles } = this.links(offer);
      if (urls.length >= 50) throw new ConflictException("A digital offer can have at most 50 download links");
      if (urls.includes(input.url)) throw new ConflictException("This download URL is already registered");
      const after = { urls: [...urls, input.url], titles: [...titles, title] };
      const result = await this.save(tx, offerId, after.urls, after.titles);
      await this.audit(tx, { offerId, actorId, action: "seller_add", before: { urls, titles }, after });
      return result;
    });
  }

  async requestChange(sellerId: string, actorId: string, offerId: string, input: RequestDownloadLinkChangeDto) {
    if (input.action === "edit") {
      if (!input.url || !input.title?.trim()) throw new BadRequestException("Editing a link requires its URL and title");
      this.validateUrls([input.url]);
    } else if (input.url !== undefined || input.title !== undefined) {
      throw new BadRequestException("A deletion request cannot contain a replacement link");
    }
    return this.write(async (tx) => {
      const offer = await this.offer(tx, offerId, sellerId);
      const { urls, titles } = this.links(offer);
      if (input.linkIndex >= urls.length) throw new NotFoundException("Download link was not found");
      if (input.action === "delete" && urls.length === 1) throw new ConflictException("A digital offer needs at least one download link");
      if (input.action === "edit" && input.url === urls[input.linkIndex] && input.title!.trim() === titles[input.linkIndex]) {
        throw new BadRequestException("The proposed link is unchanged");
      }
      if (input.action === "edit" && urls.some((url, index) => index !== input.linkIndex && url === input.url)) {
        throw new ConflictException("This download URL is already registered");
      }
      const request = await tx.download_link_change_requests.create({ data: {
        offer_id: offerId, seller_id: sellerId, requested_by_id: actorId,
        action: input.action, link_index: input.linkIndex,
        expected_url: urls[input.linkIndex]!, expected_title: titles[input.linkIndex]!,
        proposed_url: input.action === "edit" ? input.url! : null,
        proposed_title: input.action === "edit" ? input.title!.trim() : null
      }, select: { id: true, status: true } });
      return request;
    });
  }

  async listForSeller(sellerId: string, offerId: string) {
    const offer = await this.prisma.seller_offers.findFirst({ where: { id: offerId, listing: { seller_id: sellerId } }, select: { id: true } });
    if (!offer) throw new NotFoundException("Digital offer was not found");
    return this.prisma.download_link_change_requests.findMany({
      where: { offer_id: offerId, seller_id: sellerId }, orderBy: [{ requested_at: "desc" }, { id: "desc" }], take: 20,
      select: { id: true, action: true, status: true, link_index: true, expected_url: true, proposed_url: true, review_reason: true, requested_at: true, reviewed_at: true }
    });
  }

  async listPendingForAdmin() {
    return this.prisma.download_link_change_requests.findMany({
      where: { status: "pending" }, orderBy: [{ requested_at: "asc" }, { id: "asc" }], take: 50,
      select: {
        id: true, action: true, link_index: true, expected_url: true, expected_title: true,
        proposed_url: true, proposed_title: true, requested_at: true,
        requested_by: { select: { full_name: true } },
        offer: { select: { listing: { select: { product: { select: { id: true, title: true } }, seller: { select: { shop_name: true } } } }, variant: { select: { name: true } } } }
      }
    });
  }

  async review(requestId: string, reviewerId: string, input: ReviewDownloadLinkChangeDto) {
    if (input.status === "rejected" && (!input.reason || input.reason.trim().length < 3)) {
      throw new BadRequestException("A reason of at least three characters is required when rejecting a download link change");
    }
    return this.write(async (tx) => {
      const request = await tx.download_link_change_requests.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException("Download link request was not found");
      if (request.status !== "pending") throw new ConflictException("This request has already been reviewed");
      if (input.status === "approved") {
        const offer = await this.offer(tx, request.offer_id);
        if (offer.listing.seller_id !== request.seller_id) throw new ConflictException("The offer has changed seller");
        const { urls, titles } = this.links(offer);
        const before = { urls: [...urls], titles: [...titles] };
        if (urls[request.link_index] !== request.expected_url || titles[request.link_index] !== request.expected_title) {
          throw new ConflictException("The download link changed; reject this stale request and ask the seller to submit it again");
        }
        if (request.action === "delete") {
          if (urls.length === 1) throw new ConflictException("A digital offer needs at least one download link");
          urls.splice(request.link_index, 1); titles.splice(request.link_index, 1);
        } else {
          if (!request.proposed_url || !request.proposed_title) throw new ConflictException("The proposed link is incomplete");
          this.validateUrls([request.proposed_url]);
          if (urls.some((url, index) => index !== request.link_index && url === request.proposed_url)) throw new ConflictException("The proposed URL is already registered");
          urls[request.link_index] = request.proposed_url;
          titles[request.link_index] = request.proposed_title;
        }
        await this.save(tx, offer.id, urls, titles);
        await this.audit(tx, { offerId: offer.id, actorId: reviewerId, action: request.action === "delete" ? "approved_delete" : "approved_edit", before, after: { urls, titles }, requestId });
      }
      return tx.download_link_change_requests.update({ where: { id: requestId }, data: {
        status: input.status, reviewed_by_id: reviewerId, reviewed_at: new Date(), review_reason: input.reason?.trim() || null
      }, select: { id: true, status: true } });
    });
  }
}
