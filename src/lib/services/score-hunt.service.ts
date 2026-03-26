import { container } from "@sapphire/framework";
import type { TextBasedChannel } from "discord.js";

import {
  getBeatmapByIdLeaderboard,
  Mods,
} from "../types/api";
import type { GameMode, ScoreResponse } from "../types/api/types.gen";

type ScoreHuntStatus = "armed" | "active" | "cancelled" | "completed";

type ScoreHuntSettingRow = {
  guild_id: string;
  duration_seconds: number;
};

type ScoreHuntRow = {
  id: number;
  guild_id: string;
  status: ScoreHuntStatus;
  duration_seconds: number;
  started_by_discord_user_id: string;
  seed_score_id: number | null;
  seed_user_id: number | null;
  seed_total_score: number | null;
  beatmap_id: number | null;
  mode: GameMode | null;
  mods_int: number | null;
  mods_text: string | null;
  channel_id: string | null;
  announcement_message_id: string | null;
  winning_score_id: number | null;
  winning_user_id: number | null;
  started_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
};

const MOD_BIT_MAP: Array<[number, Mods]> = [
  [1 << 0, Mods.NO_FAIL],
  [1 << 1, Mods.EASY],
  [1 << 3, Mods.HIDDEN],
  [1 << 4, Mods.HARD_ROCK],
  [1 << 5, Mods.SUDDEN_DEATH],
  [1 << 6, Mods.DOUBLE_TIME],
  [1 << 8, Mods.HALF_TIME],
  [1 << 9, Mods.NIGHTCORE],
  [1 << 10, Mods.FLASHLIGHT],
  [1 << 12, Mods.SPUN_OUT],
  [1 << 14, Mods.PERFECT],
  [1 << 15, Mods.KEY4],
  [1 << 16, Mods.KEY5],
  [1 << 17, Mods.KEY6],
  [1 << 18, Mods.KEY7],
  [1 << 19, Mods.KEY8],
  [1 << 20, Mods.FADE_IN],
  [1 << 21, Mods.RANDOM],
  [1 << 24, Mods.KEY9],
  [1 << 25, Mods.KEY_COOP],
  [1 << 26, Mods.KEY1],
  [1 << 27, Mods.KEY3],
  [1 << 28, Mods.KEY2],
  [1 << 29, Mods.SCORE_V2],
];

export class ScoreHuntService {
  private readonly resolutionTimeouts = new Map<number, Timer>();

  public parseDurationToSeconds(rawDuration: string) {
    const duration = rawDuration.trim();

    if (!duration) {
      return null;
    }

    const matches = [...duration.matchAll(/(\d+)\s*(d(?:ays?)?|h(?:r|ours?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)/gi)];

    if (matches.length === 0) {
      return null;
    }

    const normalized = matches.map(match => match[0]).join("").replaceAll(/\s+/g, "").toLowerCase();
    if (normalized !== duration.replaceAll(/\s+/g, "").toLowerCase()) {
      return null;
    }

    let seconds = 0;

    for (const match of matches) {
      const amount = Number.parseInt(match[1] ?? "0", 10);
      const unit = (match[2] ?? "").toLowerCase();

      if (["d", "day", "days"].includes(unit)) {
        seconds += amount * 24 * 60 * 60;
        continue;
      }

      if (["h", "hr", "hour", "hours"].includes(unit)) {
        seconds += amount * 60 * 60;
        continue;
      }

      if (["m", "min", "mins", "minute", "minutes"].includes(unit)) {
        seconds += amount * 60;
        continue;
      }

      seconds += amount;
    }

    return seconds > 0 ? seconds : null;
  }

  public formatDuration(seconds: number) {
    const units: Array<[string, number]> = [
      ["day", 24 * 60 * 60],
      ["hour", 60 * 60],
      ["minute", 60],
      ["second", 1],
    ];

    let remaining = seconds;
    const parts: string[] = [];

    for (const [label, size] of units) {
      if (remaining < size && parts.length === 0 && size !== 1) {
        continue;
      }

      const value = Math.floor(remaining / size);
      if (value <= 0) {
        continue;
      }

      remaining -= value * size;
      parts.push(`${value} ${label}${value === 1 ? "" : "s"}`);
    }

    return parts.join(", ");
  }

  public getSettings(guildId: string) {
    return container.db.query("SELECT guild_id, duration_seconds FROM score_hunt_settings WHERE guild_id = $1")
      .get(guildId) as ScoreHuntSettingRow | null;
  }

  public setDuration(guildId: string, durationSeconds: number) {
    container.db.prepare(
      `INSERT INTO score_hunt_settings (guild_id, duration_seconds, updated_at)
       VALUES ($guild_id, $duration_seconds, CURRENT_TIMESTAMP)
       ON CONFLICT(guild_id) DO UPDATE SET
         duration_seconds = excluded.duration_seconds,
         updated_at = CURRENT_TIMESTAMP`,
    ).run({
      $guild_id: guildId,
      $duration_seconds: durationSeconds,
    });
  }

  public getCurrentHunt() {
    return container.db.query(
      `SELECT *
       FROM score_hunts
       WHERE status IN ('armed', 'active')
       ORDER BY id DESC
       LIMIT 1`,
    ).get() as ScoreHuntRow | null;
  }

  public getActiveHunt() {
    return container.db.query(
      `SELECT *
       FROM score_hunts
       WHERE status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
    ).get() as ScoreHuntRow | null;
  }

  public armHunt(guildId: string, startedByDiscordUserId: string) {
    const existingHunt = this.getCurrentHunt();

    if (existingHunt) {
      throw new Error("A score hunt is already armed or active.");
    }

    const settings = this.getSettings(guildId);
    if (!settings) {
      throw new Error("Set a score hunt duration first.");
    }

    container.db.prepare(
      `INSERT INTO score_hunts (guild_id, status, duration_seconds, started_by_discord_user_id)
       VALUES ($guild_id, 'armed', $duration_seconds, $started_by_discord_user_id)`,
    ).run({
      $guild_id: guildId,
      $duration_seconds: settings.duration_seconds,
      $started_by_discord_user_id: startedByDiscordUserId,
    });

    return this.getCurrentHunt();
  }

  public stopHunt(guildId: string) {
    const hunt = this.getCurrentHunt();

    if (!hunt) {
      throw new Error("There is no active or armed score hunt.");
    }

    if (hunt.guild_id !== guildId) {
      throw new Error("Another server owns the current score hunt.");
    }

    container.db.prepare(
      `UPDATE score_hunts
       SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
       WHERE id = $id`,
    ).run({
      $id: hunt.id,
    });

    this.clearResolution(hunt.id);
  }

  public async activateArmedHunt(score: ScoreResponse, channelId: string, announcementMessageId: string) {
    const hunt = this.getCurrentHunt();

    if (!hunt || hunt.status !== "armed") {
      return null;
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + hunt.duration_seconds * 1000);

    container.db.prepare(
      `UPDATE score_hunts
       SET status = 'active',
           seed_score_id = $seed_score_id,
           seed_user_id = $seed_user_id,
           seed_total_score = $seed_total_score,
           beatmap_id = $beatmap_id,
           mode = $mode,
           mods_int = $mods_int,
           mods_text = $mods_text,
           channel_id = $channel_id,
           announcement_message_id = $announcement_message_id,
           started_at = $started_at,
           ends_at = $ends_at
       WHERE id = $id`,
    ).run({
      $id: hunt.id,
      $seed_score_id: score.id,
      $seed_user_id: score.user_id,
      $seed_total_score: score.total_score,
      $beatmap_id: score.beatmap_id,
      $mode: score.game_mode_extended,
      $mods_int: score.mods_int ?? 0,
      $mods_text: score.mods ?? "NM",
      $channel_id: channelId,
      $announcement_message_id: announcementMessageId,
      $started_at: startedAt.toISOString(),
      $ends_at: endsAt.toISOString(),
    });

    const activeHunt = this.getActiveHunt();
    if (activeHunt) {
      this.scheduleResolution(activeHunt);
    }

    return activeHunt;
  }

  public async trackSubmittedScore(score: ScoreResponse) {
    const hunt = this.getActiveHunt();

    if (!hunt) {
      return;
    }

    if (
      hunt.beatmap_id !== score.beatmap_id
      || hunt.mode !== score.game_mode_extended
      || (hunt.mods_int ?? 0) !== (score.mods_int ?? 0)
      || hunt.seed_user_id === score.user_id
    ) {
      return;
    }

    container.db.prepare(
      `INSERT OR IGNORE INTO score_hunt_candidates (hunt_id, score_id, user_id, total_score)
       VALUES ($hunt_id, $score_id, $user_id, $total_score)`,
    ).run({
      $hunt_id: hunt.id,
      $score_id: score.id,
      $user_id: score.user_id,
      $total_score: score.total_score,
    });
  }

  public async restoreActiveHunt() {
    const hunt = this.getActiveHunt();

    if (!hunt) {
      return;
    }

    this.scheduleResolution(hunt);
  }

  public describeCurrentHunt(guildId: string) {
    const hunt = this.getCurrentHunt();
    const settings = this.getSettings(guildId);

    if (!hunt) {
      if (!settings) {
        return "No score hunt is configured for this server yet.";
      }

      return `No score hunt is active. Default duration is ${this.formatDuration(settings.duration_seconds)}.`;
    }

    const ownerText = hunt.guild_id === guildId ? "this server" : "another server";

    if (hunt.status === "armed") {
      return `A score hunt is armed by ${ownerText} and waiting for the next in-game bot score. Duration: ${this.formatDuration(hunt.duration_seconds)}.`;
    }

    const endsAt = hunt.ends_at ? new Date(hunt.ends_at) : null;
    const endsText = endsAt ? endsAt.toLocaleString() : "unknown";
    return `A score hunt is active for ${ownerText}. Target mods: ${hunt.mods_text ?? "NM"}. Ends at ${endsText}.`;
  }

  private clearResolution(huntId: number) {
    const timeout = this.resolutionTimeouts.get(huntId);

    if (timeout) {
      clearTimeout(timeout);
      this.resolutionTimeouts.delete(huntId);
    }
  }

  private scheduleResolution(hunt: ScoreHuntRow) {
    this.clearResolution(hunt.id);

    const endsAt = hunt.ends_at ? new Date(hunt.ends_at).getTime() : 0;
    const timeoutMs = endsAt - Date.now();

    if (timeoutMs <= 0) {
      void this.resolveHunt(hunt.id);
      return;
    }

    const timeout = setTimeout(() => {
      void this.resolveHunt(hunt.id);
    }, timeoutMs);

    this.resolutionTimeouts.set(hunt.id, timeout);
  }

  private async resolveHunt(huntId: number) {
    const hunt = container.db.query("SELECT * FROM score_hunts WHERE id = $1").get(huntId) as ScoreHuntRow | null;

    if (!hunt || hunt.status !== "active" || !hunt.beatmap_id || !hunt.mode) {
      return;
    }

    const leaderboard = await getBeatmapByIdLeaderboard({
      path: {
        id: hunt.beatmap_id,
      },
      query: {
        mode: hunt.mode,
        limit: 1,
        ...(hunt.mods_int && hunt.mods_int > 0 ? { mods: this.modsIntToArray(hunt.mods_int) } : {}),
      },
    });

    const topScore = leaderboard.error ? null : leaderboard.data.scores[0] ?? null;
    const isTrackedCandidate = topScore
      ? container.db.query(
          "SELECT score_id FROM score_hunt_candidates WHERE hunt_id = $1 AND score_id = $2",
        ).get(hunt.id, topScore.id)
      : null;

    const hasWinner = Boolean(
      topScore
      && isTrackedCandidate
      && topScore.id !== hunt.seed_score_id
      && topScore.user_id !== hunt.seed_user_id
      && topScore.total_score > (hunt.seed_total_score ?? 0),
    );

    container.db.prepare(
      `UPDATE score_hunts
       SET status = 'completed',
           winning_score_id = $winning_score_id,
           winning_user_id = $winning_user_id,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $id`,
    ).run({
      $id: hunt.id,
      $winning_score_id: hasWinner ? topScore?.id : null,
      $winning_user_id: hasWinner ? topScore?.user_id : null,
    });

    this.clearResolution(hunt.id);

    const channelId = hunt.channel_id ?? container.config.ids.scoreHuntChannel;
    if (!channelId) {
      return;
    }

    const channel = await container.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isSendable()) {
      return;
    }

    await this.sendResolutionMessage(channel, hunt, hasWinner ? topScore : null);
  }

  private async sendResolutionMessage(channel: TextBasedChannel, hunt: ScoreHuntRow, winner: ScoreResponse | null) {
    const { embedPresets } = container.utilities;

    if (!winner) {
      await channel.send({
        content: "Score hunt ended. No winner this time.",
        embeds: [
          embedPresets.getErrorEmbed(
            "Score hunt ended",
            `Nobody beat the seed score on ${hunt.mods_text ?? "NM"} during the hunt window.`,
          ),
        ],
      });
      return;
    }

    await channel.send({
      content: `Score hunt ended. Winner is ingame user: ${winner.user.username}. Please open up a ticket to claim your reward!`,
      embeds: [
        embedPresets.getSuccessEmbed(
          "Score hunt ended",
          `${winner.user.username} claimed #1 for ${hunt.mods_text ?? "NM"} and won the hunt.`,
        ),
      ],
    });
  }

  private modsIntToArray(modsInt: number) {
    return MOD_BIT_MAP
      .filter(([bit]) => (modsInt & bit) === bit)
      .map(([, mod]) => mod);
  }
}

export const scoreHuntService = new ScoreHuntService();
