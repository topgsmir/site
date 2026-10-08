"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { formatCurrencyAmount } from "@/lib/currency";
import { AccountIcon } from "../AccountIcon";
import { DashboardIcon } from "./DashboardIcon";
import { DASHBOARD_COPY } from "./DashboardCopy";
import { useDashboardResource, type DashboardBoard, type DashboardClub, type DashboardWallet } from "./useDashboardResource";
import styles from "./AccountDashboard.module.css";

function ResourceNotice({ locale, error, retry }: { locale: Locale; error: boolean; retry: () => Promise<void> }) {
  const copy = DASHBOARD_COPY[locale];
  return <div className={styles.resourceNotice} role={error ? "alert" : "status"}>
    <span>{error ? copy.error : copy.loading}</span>
    {error ? <button type="button" onClick={() => void retry()}>{copy.retry}</button> : null}
  </div>;
}

export function AccountDashboard({ locale }: { locale: Locale }) {
  const copy = DASHBOARD_COPY[locale];
  const wallet = useDashboardResource<DashboardWallet>("/wallet");
  const board = useDashboardResource<DashboardBoard>("/orders/leaderboard");
  const club = useDashboardResource<DashboardClub>("/club/me");
  const href = (path: string) => `/${locale}${path}` as Route;
  const number = (value: string | number) => new Intl.NumberFormat(locale).format(typeof value === "string" ? BigInt(value) : value);
  const leaders = board.data?.leaders.slice(0, 10) ?? [];
  const account = board.data?.you;
  const totalScore = leaders.reduce((total, leader) => total + BigInt(leader.score), 0n);
  const points = [
    { icon: "cart", label: copy.purchases, value: board.data ? number(board.data.you.orderCount) : "—", source: "board" },
    { icon: "orders", label: copy.items, value: board.data ? number(board.data.you.quantity) : "—", source: "board" },
    { icon: "rank", label: copy.purchasePoints, value: board.data ? number(board.data.you.score) : "—", source: "board" },
    { icon: "wallet", label: copy.availablePoints, value: club.data?.enabled ? number(club.data.balance) : "—", source: "club" },
    { icon: "star", label: copy.expiring, value: club.data?.enabled ? number(club.data.expiringPoints) : "—", source: "club" },
  ] as const;

  return <div className={styles.dashboard} data-account-enter>
    <section className={styles.notice} aria-label={copy.notice}>
      <p>{copy.noticeBody}</p>
    </section>
    <div className={styles.topRow}>
      <nav className={styles.shortcuts} aria-label={copy.orders}>
        <Link href={href("/account/orders")}><div><strong>{copy.downloads}</strong><span>{copy.downloadHint}</span></div><span className={styles.shortcutIcon}><DashboardIcon name="download" /></span></Link>
        <Link href={href("/account/orders")}><div><strong>{copy.orders}</strong><span>{board.data && !board.error ? `${copy.purchases}: ${number(board.data.you.orderCount)}` : copy.orderHint}</span></div><span className={styles.shortcutIcon}><AccountIcon name="orders" /></span></Link>
      </nav>
      <section className={styles.services} aria-labelledby="dashboard-services">
        <header className={styles.panelHeading}><h2 id="dashboard-services">{copy.services}</h2><Link href={href("/products")}>{copy.allServices}<AccountIcon name="arrow" /></Link></header>
        <div className={styles.serviceGrid}>
          <Link href={href("/products?type=service")}><span className={styles.serviceIcon}><DashboardIcon name="wrench" /></span><strong>{copy.online}</strong><small>{copy.onlineHint}</small><AccountIcon name="arrow" /></Link>
          <Link href={href("/products?type=digital")}><span className={styles.serviceIcon}><AccountIcon name="file" /></span><strong>{copy.learning}</strong><small>{copy.learningHint}</small><AccountIcon name="arrow" /></Link>
          <Link href={href("/products?type=physical")}><span className={styles.serviceIcon}><DashboardIcon name="bag" /></span><strong>{copy.tools}</strong><small>{copy.toolsHint}</small><AccountIcon name="arrow" /></Link>
        </div>
      </section>
      <section className={styles.wallet} aria-labelledby="dashboard-wallet">
        <header><h2 id="dashboard-wallet">{copy.wallet}</h2><span><AccountIcon name="wallet" /></span></header>
        <div className={styles.walletBalance}>
          <div className={styles.balanceText}><span>{copy.balance}</span>{wallet.data && !wallet.error ? <><strong>{formatCurrencyAmount(wallet.data.balance, wallet.data.currency, locale)}</strong><small>{copy.unit}</small></> : <ResourceNotice locale={locale} error={wallet.error} retry={wallet.reload} />}</div>
          <svg className={styles.coins} width="64" height="72" viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id="dashboard-coin" x1="0" x2="1"><stop stopColor="#e39100" /><stop offset=".5" stopColor="#ffdd62" /><stop offset="1" stopColor="#ffb900" /></linearGradient></defs>{[44, 32, 20].map((position) => <g key={position}><path d={`M6 ${position}v12c0 14 52 14 52 0v-12`} fill="url(#dashboard-coin)" stroke="#ffd94e" strokeWidth="2" /><ellipse cx="32" cy={position} rx="26" ry="10" fill="#ffe18a" stroke="#ffb710" strokeWidth="2" /><ellipse cx="32" cy={position} rx="18" ry="6" fill="none" stroke="#fff3bd" strokeWidth="2" /></g>)}</svg>
          <Link href={href("/account/wallet")}><DashboardIcon name="plus" />{copy.addFunds}</Link>
        </div>
      </section>
    </div>
    <div className={styles.middleRow}>
      <section className={styles.board} aria-labelledby="dashboard-leaderboard">
        <header className={styles.boardHeading}><DashboardIcon name="crown" /><div><h2 id="dashboard-leaderboard">{copy.board}</h2><p>{copy.boardHint}</p></div></header>
        {!board.data || board.error ? <ResourceNotice locale={locale} error={board.error} retry={board.reload} /> : <>
          {account ? (
            <div className={styles.champion} aria-label={copy.yourRank}>
              <div className={styles.championIdentity}><span className={styles.championAvatar} aria-hidden="true">{account.place === 1 ? <DashboardIcon name="crown" /> : null}{Array.from(account.name.trim()).slice(0, 2).join("")}</span><div><small>{copy.countryRank}: {account.place === null ? copy.unranked : number(account.place)}</small><strong><bdi>{account.name}</bdi></strong><span>{copy.member}</span></div></div>
              <div className={styles.championScore}><DashboardIcon name="trophy" /><div><span>{copy.totalScore}</span><strong>{number(account.score)}</strong></div></div>
            </div>
          ) : null}
          {leaders.length ? (
            <div className={styles.tableWrap} role="region" aria-label={copy.topTen} tabIndex={0}><table className={styles.table}><caption className="sr-only">{copy.topTen}</caption><thead><tr><th scope="col">#</th><th scope="col">{copy.name}</th><th scope="col">{copy.totalScore}</th><th scope="col">{copy.share}</th></tr></thead><tbody>{leaders.map((leader, index) => {
              const percentage = totalScore > 0n ? Number(BigInt(leader.score) * 1000n / totalScore) / 10 : 0;
              return <tr key={leader.place} data-you={leader.isYou || undefined}><td>{number(leader.place)}</td><th scope="row"><span className={styles.tablePerson}><span className={styles.smallAvatar} aria-hidden="true">{Array.from(leader.name.trim()).slice(0, 1)}</span><bdi>{leader.name}</bdi></span></th><td>{number(leader.score)}</td><td><span className={styles.share}><span className={styles.track}><span data-color={index % 4} style={{ width: `${percentage}%` }} /></span><span>{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(percentage / 100)}</span></span></td></tr>;
            })}</tbody></table></div>
          ) : <div className={styles.empty}><DashboardIcon name="trophy" /><p>{copy.empty}</p><Link href={href("/products")}>{copy.allServices}<AccountIcon name="arrow" /></Link></div>}
        </>}
      </section>
      <section className={styles.promo} aria-labelledby="dashboard-training">
        <div className={styles.promoArtwork} style={{ position: "absolute" }}><Image src="/images/account/repair-training.png" alt="" fill loading="eager" sizes="(max-width: 600px) 50vw, 280px" /></div>
        <div className={styles.promoContent}><p>{copy.promoKicker}</p><h2 id="dashboard-training">{copy.promoTitle} <span>{copy.promoAccent}</span></h2><ul>{copy.benefits.map((benefit) => <li key={benefit}><AccountIcon name="check" />{benefit}</li>)}</ul><Link href={href("/products?type=digital")}>{copy.promoAction}<AccountIcon name="arrow" /></Link></div>
      </section>
    </div>
    <section className={styles.points} aria-labelledby="dashboard-points">
      <header className={styles.panelHeading}><h2 id="dashboard-points"><DashboardIcon name="star" />{copy.points}</h2><Link className={styles.spendPoints} href={href("/account/club")}><AccountIcon name="wallet" />{copy.spendPoints}</Link></header>
      <dl className={styles.pointGrid}>{points.map((point) => <div key={point.label}><span className={styles.pointIcon}>{point.icon === "star" ? <DashboardIcon name="star" /> : <AccountIcon name={point.icon} />}</span><div><dt>{point.label}</dt><dd>{(point.source === "board" ? board.error : club.error) ? "—" : point.value}</dd></div></div>)}</dl>
      {board.error ? <ResourceNotice locale={locale} error retry={board.reload} /> : null}
      {club.error ? <ResourceNotice locale={locale} error retry={club.reload} /> : club.data && !club.data.enabled ? <p className={styles.clubNote}>{copy.clubDisabled}</p> : <Link className={styles.clubLink} href={href("/account/club")}>{copy.clubDetails}<AccountIcon name="arrow" /></Link>}
    </section>
  </div>;
}
