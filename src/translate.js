import Pool from "p-limit";
import util from "util";
import yargs from "yargs";

import * as Schema from "./schema";
import * as Cesium from "./cesium";
import * as Util from "./util";
import * as Laszip from "./laszip";
import * as Binary from "./binary";
import * as Key from "./key";
import { scanColorOptions, scanColorOptionsResults } from "./scanColorOptions";

async function translateMetadata({ input, output, threads }) {
  const root = Util.join(input, "ept-hierarchy");
  const files = (await Util.readDirAsync(root)).map((v) =>
    v == "0-0-0-0.json" ? "tileset.json" : v
  );

  const pool = Pool(threads);
  const tasks = files.map((file) =>
    pool(async () => {
      const tileset = await Cesium.translate(
        Util.join(input, "ept-tileset", file)
      );
      await Util.writeFileAsync(
        Util.join(output, file),
        JSON.stringify(tileset)
      );
    })
  );

  return Promise.all(tasks);
}

async function translatePoints({ input, output, threads }) {
  const root = Util.join(input, "ept-data");
  const files = (await Util.readDirAsync(root))
    .map((v) => v.split(".")[0])
    .map((v) => v + ".pnts");

  const pool = Pool(threads);
  const tasks = files.map((file, i) =>
    pool(async () => {
      console.log((i + 1).toString() + "/" + files.length + ":", file);
      const pnts = await Cesium.translate(
        Util.join(input, "ept-tileset", file)
      );
      await Util.writeFileAsync(Util.join(output, file), pnts);
    })
  );

  return Promise.all(tasks);
}

export async function translate({ input, output, threads, force }) {
  if (
    !force &&
    (await Util.fileExistsAsync(Util.join(output, "tileset.json")))
  ) {
    throw new Error("Output already exists - use --force to overwrite");
  }

  await Util.mkdirpAsync(output);

  console.log("Translating metadata...");
  console.time("Metadata");
  await translateMetadata({ input, output, threads });
  console.timeEnd("Metadata");

  console.log("Scanning files for color options...");
  console.time("Color");
  await scanColorOptions({ input, threads });
  console.log(scanColorOptionsResults);
  console.timeEnd("Color");

  console.log("Translating points");
  console.time("Points");
  await translatePoints({ input, output, threads });
  console.timeEnd("Points");
}
