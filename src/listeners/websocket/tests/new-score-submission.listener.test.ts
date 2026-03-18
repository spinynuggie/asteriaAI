import type { Listener } from "@sapphire/framework";
import { container } from "@sapphire/framework";
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { ButtonStyle } from "discord.js";

import { FakerGenerator } from "../../../lib/mock/faker.generator";
import { Mocker } from "../../../lib/mock/mocker";
import { GameMode } from "../../../lib/types/api";

describe("New Score Submission Listener", () => {
  const getBeatmapByIdMock = mock();
  const getBeatmapByIdLeaderboardMock = mock();

  let listener: Listener;

  beforeAll(async () => {
    Mocker.createSapphireClientInstance();

    Mocker.mockApiRequests({
      WebSocketEventType: {
        NEW_SCORE_SUBMITTED: "NewScoreSubmitted",
      },
      getBeatmapById: getBeatmapByIdMock,
      getBeatmapByIdLeaderboard: getBeatmapByIdLeaderboardMock,
    });

    const { NewScoreSubmissionListener } = await import("../new-score-submission.listener");
    listener = new NewScoreSubmissionListener(FakerGenerator.generatePiece(), {});
  });

  afterAll(async () => {
    await Mocker.resetSapphireClientInstance();
  });

  beforeEach(() => {
    getBeatmapByIdMock.mockReset();
    getBeatmapByIdLeaderboardMock.mockReset();
    container.config.ids.newScoresChannel = "123";
  });

  it("should send score embed when submitted score is #1 on the beatmap leaderboard", async () => {
    const sendMock = mock();
    const score = FakerGenerator.generateScore({
      id: 42,
      beatmap_id: 1337,
      game_mode: GameMode.MANIA,
    });
    const beatmap = FakerGenerator.generateBeatmap({ id: score.beatmap_id });
    const scoreEmbed = { data: { title: "score embed" } };

    container.client.channels.fetch = mock().mockResolvedValue({
      isSendable: () => true,
      send: sendMock,
    }) as any;
    container.utilities.embedPresets.getScoreEmbed = mock().mockResolvedValue(scoreEmbed) as any;

    getBeatmapByIdLeaderboardMock.mockResolvedValue({
      data: {
        scores: [score],
        total_count: 1,
      },
    });
    getBeatmapByIdMock.mockResolvedValue({
      data: beatmap,
    });

    await listener.run(score);

    expect(sendMock).toHaveBeenCalledWith({
      embeds: [scoreEmbed],
      components: [
        expect.objectContaining({
          components: [
            expect.objectContaining({
              data: expect.objectContaining({
                style: ButtonStyle.Link,
                label: "View score online",
                url: `https://${container.config.sunrise.uri}/score/${score.id}`,
              }),
            }),
          ],
        }),
      ],
    });
  });

  it("should not send score embed when submitted score is not #1 on the beatmap leaderboard", async () => {
    const sendMock = mock();
    const score = FakerGenerator.generateScore({
      id: 42,
      beatmap_id: 1337,
      game_mode: GameMode.STANDARD,
    });

    container.client.channels.fetch = mock().mockResolvedValue({
      isSendable: () => true,
      send: sendMock,
    }) as any;
    container.utilities.embedPresets.getScoreEmbed = mock() as any;

    getBeatmapByIdLeaderboardMock.mockResolvedValue({
      data: {
        scores: [FakerGenerator.generateScore({ id: 7, beatmap_id: score.beatmap_id })],
        total_count: 1,
      },
    });

    await listener.run(score);

    expect(getBeatmapByIdMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
