import type { Subcommand } from "@sapphire/plugin-subcommands";
import type { SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import type { OsuCommand } from "../../commands/osu.command";
import { ExtendedError } from "../../lib/extended-error";
import { scoreHuntService } from "../../lib/services/score-hunt.service";

export function addScoreHuntDurationSubcommand(command: SlashCommandSubcommandBuilder) {
  return command
    .setName("score-hunt-duration")
    .setDescription("Set the default duration for score hunts")
    .addStringOption(o =>
      o
        .setName("duration")
        .setDescription("Examples: 30Min, 5Hour, 1D 12H")
        .setRequired(true),
    );
}

export async function chatInputRunScoreHuntDurationSubcommand(
  this: OsuCommand,
  interaction: Subcommand.ChatInputCommandInteraction,
) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    throw new ExtendedError("Score hunt configuration can only be used inside a server.");
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    throw new ExtendedError("You must be a server administrator to configure score hunts.");
  }

  const duration = interaction.options.getString("duration", true);
  const parsedDuration = scoreHuntService.parseDurationToSeconds(duration);

  if (!parsedDuration) {
    throw new ExtendedError("Invalid duration. Try values like 30Min, 5Hour, or 1D 12H.");
  }

  scoreHuntService.setDuration(interaction.guildId, parsedDuration);

  await interaction.editReply({
    embeds: [
      this.container.utilities.embedPresets.getSuccessEmbed(
        "Score hunt duration updated",
        `New default duration is ${scoreHuntService.formatDuration(parsedDuration)}.`,
      ),
    ],
  });
}