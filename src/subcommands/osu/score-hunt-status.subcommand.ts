import type { Subcommand } from "@sapphire/plugin-subcommands";
import type { SlashCommandSubcommandBuilder } from "discord.js";

import type { OsuCommand } from "../../commands/osu.command";
import { ExtendedError } from "../../lib/extended-error";
import { scoreHuntService } from "../../lib/services/score-hunt.service";

export function addScoreHuntStatusSubcommand(command: SlashCommandSubcommandBuilder) {
  return command
    .setName("score-hunt-status")
    .setDescription("Show the current score hunt status");
}

export async function chatInputRunScoreHuntStatusSubcommand(
  this: OsuCommand,
  interaction: Subcommand.ChatInputCommandInteraction,
) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    throw new ExtendedError("Score hunt status can only be checked inside a server.");
  }

  await interaction.editReply({
    embeds: [
      this.container.utilities.embedPresets.getSuccessEmbed(
        "Score hunt status",
        scoreHuntService.describeCurrentHunt(interaction.guildId),
      ),
    ],
  });
}