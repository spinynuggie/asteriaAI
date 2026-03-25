import path from "node:path";

export interface IConfig {
  discord: {
    token: string;
  };
  ids: {
    newScoresChannel: string | undefined;
    scoreHuntChannel: string | undefined;
    beatmapsEventsChannel: string | undefined;
  };
  sunrise: {
    uri: string;
  };
  environment: "prod" | "dev";
  json: {
    emojis: {
      ranks: {
        F: string;
        S: string;
        D: string;
        C: string;
        B: string;
        A: string;
        X: string;
        XH: string;
        SH: string;
      };
      countSlidersIcon: string;
      countCirclesIcon: string;
      bpmIcon: string;
      totalLengthIcon: string;
      rankedStatus: string;
    };
  };
}

const requiredEnvVariables = ["DISCORD_TOKEN", "SUNRISE_URI"];
requiredEnvVariables.forEach((v) => {
  if (!process.env[v]) {
    if (process.env.NODE_ENV === "test")
      return;
    throw new Error(`${v} is not provided in environment file!`);
  }
});

const env = ["prod", "dev"].includes(process.env.NODE_ENV ?? "")
  ? (process.env.NODE_ENV as any)
  : "dev";

export const config: IConfig = {
  discord: {
    token: process.env["DISCORD_TOKEN"]!,
  },
  sunrise: {
    uri: process.env["SUNRISE_URI"]!,
  },
  ids: {
    newScoresChannel: process.env["NEW_SCORES_CHANNED_ID"] ?? undefined,
    scoreHuntChannel: process.env["SCORE_HUNT_CHANNEL_ID"] ?? undefined,
    beatmapsEventsChannel: process.env["BEATMAPS_STATUSES_CHANNED_ID"] ?? undefined,
  },
  environment: env,
  // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module -- used to load JSON
  json: require(path.resolve(process.cwd(), "config", `${env}.json`)),
};
