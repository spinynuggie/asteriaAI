import type { Listener } from "@sapphire/framework";
import { container } from "@sapphire/framework";
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

import { FakerGenerator } from "../../../lib/mock/faker.generator";
import { Mocker } from "../../../lib/mock/mocker";

describe("Bot Score Submission Listener", () => {
  const getBeatmapByIdMock = mock();

  let listener: Listener;

  beforeAll(async () => {
    Mocker.createSapphireClientInstance();

    Mocker.mockApiRequests({
      WebSocketEventType: {
        BOT_SCORE_SUBMITTED: "BotScoreSubmitted",
      },
      getBeatmapById: getBeatmapByIdMock,
    });

    const { BotScoreSubmissionListener } = await import("../bot-score-submission.listener");
    listener = new BotScoreSubmissionListener(FakerGenerator.generatePiece(), {});
  });

  afterAll(async () => {
    await Mocker.resetSapphireClientInstance();
  });

  beforeEach(() => {
    getBeatmapByIdMock.mockReset();
    container.config.ids.scoreHuntChannel = "456";
    container.db.prepare(
      `INSERT INTO score_hunt_settings (guild_id, duration_seconds)
       VALUES ($guild_id, $duration_seconds)`,
    ).run({
      $guild_id: "guild-1",
      $duration_seconds: 1800,
    });
    container.db.prepare(
      `INSERT INTO score_hunts (guild_id, status, duration_seconds, started_by_discord_user_id)
       VALUES ($guild_id, 'armed', $duration_seconds, $started_by_discord_user_id)`,
    ).run({
      $guild_id: "guild-1",
      $duration_seconds: 1800,
      $started_by_discord_user_id: "admin-1",
    });
  });

  it("should post a hunt embed and activate the hunt when a bot score arrives", async () => {
    const sendMock = mock().mockResolvedValue({ id: "message-1" });
    const score = FakerGenerator.generateScore({
      id: 42,
      beatmap_id: 1337,
      mods: "HDHR",
      mods_int: 24,
    });
    const beatmap = FakerGenerator.generateBeatmap({ id: score.beatmap_id });
    const scoreEmbed = { data: { title: "score hunt" } };

    container.client.channels.fetch = mock().mockResolvedValue({
      isSendable: () => true,
      send: sendMock,
    }) as any;
    container.utilities.embedPresets.getScoreHuntEmbed = mock().mockResolvedValue(scoreEmbed) as any;

    getBeatmapByIdMock.mockResolvedValue({
      data: beatmap,
    });

    await listener.run(score);

    expect(sendMock).toHaveBeenCalledWith({
      embeds: [scoreEmbed],
      components: [expect.anything()],
    });

    const row = container.db.query(
      "SELECT status, seed_score_id, beatmap_id, mods_int FROM score_hunts ORDER BY id DESC LIMIT 1",
    ).get() as {
      status: string;
      seed_score_id: number;
      beatmap_id: number;
      mods_int: number;
    };

    expect(row).toEqual({
      status: "active",
      seed_score_id: score.id,
      beatmap_id: score.beatmap_id,
      mods_int: score.mods_int,
    });
  });
});
