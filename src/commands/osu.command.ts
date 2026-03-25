import { ApplyOptions } from "@sapphire/decorators";
import type { Command } from "@sapphire/framework";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { SlashCommandSubcommandBuilder } from "discord.js";

import * as link from "../subcommands/osu/link.subcommand";
import * as profile from "../subcommands/osu/profile.subcommand";
import * as recentScore from "../subcommands/osu/recent-score.subcommand";
import * as score from "../subcommands/osu/score.subcommand";
import * as scoreHuntDuration from "../subcommands/osu/score-hunt-duration.subcommand";
import * as scoreHuntStart from "../subcommands/osu/score-hunt-start.subcommand";
import * as scoreHuntStatus from "../subcommands/osu/score-hunt-status.subcommand";
import * as scoreHuntStop from "../subcommands/osu/score-hunt-stop.subcommand";
import * as scores from "../subcommands/osu/scores.subcommand";
import * as unlink from "../subcommands/osu/unlink.subcommand";

const rawModules = [
  { add: profile.addProfileSubcommand, run: profile.chatInputRunProfileSubcommand },
  { add: score.addScoreSubcommand, run: score.chatInputRunScoreSubcommand },
  { add: link.addLinkSubcommand, run: link.chatInputRunLinkSubcommand },
  { add: unlink.addUnlinkSubcommand, run: unlink.chatInputRunUnlinkSubcommand },
  { add: recentScore.addRecentScoreSubcommand, run: recentScore.chatInputRunRecentScoreSubcommand },
  { add: scores.addScoresSubcommand, run: scores.chatInputRunScoresSubcommand },
  { add: scoreHuntDuration.addScoreHuntDurationSubcommand, run: scoreHuntDuration.chatInputRunScoreHuntDurationSubcommand },
  { add: scoreHuntStart.addScoreHuntStartSubcommand, run: scoreHuntStart.chatInputRunScoreHuntStartSubcommand },
  { add: scoreHuntStatus.addScoreHuntStatusSubcommand, run: scoreHuntStatus.chatInputRunScoreHuntStatusSubcommand },
  { add: scoreHuntStop.addScoreHuntStopSubcommand, run: scoreHuntStop.chatInputRunScoreHuntStopSubcommand },
];

const subcommandModules = rawModules.map((cmd) => {
  const builder = new SlashCommandSubcommandBuilder();
  const subcommandName = cmd.add(builder).name;

  const camelName = subcommandName.replaceAll(/-(\w)/g, (_, letter) => letter.toUpperCase());
  return { ...cmd, name: subcommandName, camelName };
});

const subcommandOptions = subcommandModules.map(cmd => ({
  name: cmd.name,
  chatInputRun: cmd.camelName,
}));

@ApplyOptions<Subcommand.Options>({
  subcommands: subcommandOptions,
})
export class OsuCommand extends Subcommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      const osu = builder.setName("osu").setDescription("Server's commands");

      for (const cmd of subcommandModules) {
        osu.addSubcommand(cmd.add);
      }

      return osu;
    });
  }

  constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
    super(context, options);

    for (const cmd of subcommandModules) {
      ;(this as any)[cmd.name] = async (interaction: Subcommand.ChatInputCommandInteraction) => {
        return (cmd.run as any).call(this, interaction);
      };
    }
  }
}
