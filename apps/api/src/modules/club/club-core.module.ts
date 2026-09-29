import { Module } from "@nestjs/common";
import { WalletCoreModule } from "../wallet/wallet-core.module";
import { ClubService } from "./club.service";

@Module({ imports: [WalletCoreModule], providers: [ClubService], exports: [ClubService] })
export class ClubCoreModule {}
