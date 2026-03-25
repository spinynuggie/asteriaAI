import { ApplyOptions } from "@sapphire/decorators";
import { container, Listener } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { scoreHuntService } from "../../lib/services/score-hunt.service";
import type { ScoreResponse } from "../../lib/types/api";
import {
  getBeatmapById,
  WebSocketEventType,
} from "../../lib/types/api";

@ApplyOptions<Listener.Options>({
  event: WebSocketEventType.BOT_SCORE_SUBMITTED,
  emitter: container.client.ws,
})
export class BotScoreSubmissionListener extends Listener {
  public async run(score: ScoreResponse) {
    const armedHunt = scoreHuntService.getCurrentHunt();
    const { scoreHuntChannel } = this.container.config.ids;

    if (!armedHunt || armedHunt.status !== "armed" || !scoreHuntChannel) {
      return;
    }

    const scoreHuntChannelEntity = await this.container.client.channels
      .fetch(scoreHuntChannel.toString())
      .catch(() => {
        this.container.client.logger.error("BotScoreSubmissionListener: Couldn't fetch score hunt channel");
        return null;
      });

    if (!scoreHuntChannelEntity || !scoreHuntChannelEntity.isSendable()) {
      this.container.client.logger.error(
        `BotScoreSubmissionListener: Can't send score hunt embed. Check if hunt channel ${scoreHuntChannel} exists.`,
      );
      return;
    }

    const beatmap = await getBeatmapById({
      path: {
        id: score.beatmap_id,
      },
    });

    if (!beatmap || beatmap.error) {
      this.container.client.logger.error(
        `BotScoreSubmissionListener: Couldn't fetch score's (id: ${score.id}) beatmap (id: ${score.beatmap_id}).`,
      );
      return;
    }

    const endsAt = new Date(Date.now() + armedHunt.duration_seconds * 1000);
    const { embedPresets } = this.container.utilities;
    const scoreEmbed = await embedPresets.getScoreHuntEmbed(
      score,
      beatmap.data,
      scoreHuntService.formatDuration(armedHunt.duration_seconds),
      endsAt,
    );

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setURL(`https://${this.container.config.sunrise.uri}/score/${score.id}`)
        .setLabel("View score online")
        .setStyle(ButtonStyle.Link),
    );

    const message = await scoreHuntChannelEntity.send({
      embeds: [scoreEmbed],
      components: [buttons],
    });

    await scoreHuntService.activateArmedHunt(score, scoreHuntChannel, message.id);
  }
}