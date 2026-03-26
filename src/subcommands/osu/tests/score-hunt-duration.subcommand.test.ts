import { faker } from "@faker-js/faker";
import { container } from "@sapphire/framework";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from "bun:test";

import { OsuCommand } from "../../../commands/osu.command";
import { FakerGenerator } from "../../../lib/mock/faker.generator";
import { Mocker } from "../../../lib/mock/mocker";

describe("Score Hunt Duration Subcommand", () => {
  let osuCommand: OsuCommand;
  let errorHandler: jest.Mock;

  beforeAll(() => {
    Mocker.createSapphireClientInstance();
    osuCommand = Mocker.createCommandInstance(OsuCommand);
    errorHandler = Mocker.createErrorHandler();
  });

  afterAll(async () => {
    await Mocker.resetSapphireClientInstance();
  });

  beforeEach(() => Mocker.beforeEachCleanup(errorHandler));

  it("should store the configured hunt duration for the guild", async () => {
    const editReplyMock = mock();
    const guildId = faker.string.uuid();

    const interaction = FakerGenerator.withSubcommand(
      FakerGenerator.generateInteraction({
        guildId,
        deferReply: mock(),
        editReply: editReplyMock,
        memberPermissions: {
          has: jest.fn().mockReturnValue(true),
        } as any,
        options: {
          getString: jest.fn((name: string) =>
            name === "duration" ? "30Min" : null,
          ),
        },
      }),
      "score-hunt-duration",
    );

    await osuCommand.chatInputRun(interaction, {
      commandId: faker.string.uuid(),
      commandName: "score-hunt-duration",
    });

    expect(errorHandler).not.toBeCalled();
    expect(editReplyMock).toHaveBeenCalled();

    const row = container.db.query(
      "SELECT duration_seconds FROM score_hunt_settings WHERE guild_id = $1",
    ).get({
      $1: guildId,
    });

    expect(row).toEqual({ duration_seconds: 1800 });
  });
});
