import Pool from "p-limit";
import * as Util from "./util";
import * as Cesium from './cesium';
import * as Key from './key';
import * as Binary from './binary';
import * as Laszip from './laszip';
import * as Schema from './schema';

/**
 * Module I've added on to ept-tools to go through the ept data and determine whether to use rgb values or the intensity
 * values. If intensity if selected the values need to be normalized to produce a greyscale point cloud
 */

/**
 * scanned is true if a scan was performed and these values can be used
 * rgb will be false if there is a number of files that have no rgb values
 * intensity will be true if the intensity values are to be used
 * intensity min value is used for normalization
 * intensity max value is used for normalization
 */
export const scanColorOptionsResults = {
  scanned: false,
  useRgb: false,
  useIntensity: false,
  intensityMinValue: null,
  intensityMaxValue: null
};

/**
 * Scans the ept dataset to determine the values to use for colors 
 * @param {} param0 
 */
export async function scanColorOptions({ input, threads }) {
  const minValues = [];
  const maxValues = [];
  let filesWithNoRgb = 0;

  const root = Util.join(input, "ept-data");
  const files = await Util.readDirAsync(root);
  const pool = Pool(threads);

  const tasks = files.map(file => 
    pool(async () => {
      const filename = Util.join(input, "ept-tileset", file);

      const eptRoot = Util.protojoin(Util.dirname(filename), "..");
      const [root] = Util.basename(filename).split(".");

      const ept = await Util.getJson(Util.protojoin(eptRoot, "ept.json"));
      const { schema, dataType } = ept;
      const dataExtension = Cesium.dataExtensions[dataType];
      const key = Key.create(...root.split("-").map(v => parseInt(v, 10)));
      const extract = Binary.getExtractor(schema, "Intensity");

      let buffer = await Util.getBuffer(
        Util.protojoin(
          eptRoot,
          "ept-data",
          Key.stringify(key) + `.${dataExtension}`
        )
      );

      if (dataType === "zstandard") {
        buffer = await Zstandard.decompress(buffer);
      } else if (dataType === "laszip") {
        buffer = await Laszip.decompress(buffer, ept);
      }

      // Get the intensites from the laz file and add the max and min to the arrays
      const points = buffer.length / Schema.pointSize(schema);
      const intensities = new Array(points);

      for (let point = 0; point < points; ++point) {
        intensities[point] = extract(buffer, point);
      }
      
      maxValues.push(Math.max.apply(Math, intensities));
      minValues.push(Math.min.apply(Math, intensities));

      let zerosInFile = 0;

      const extractors = ["Red", "Green", "Blue"].map(v =>
        Binary.getExtractor(schema, v)
      );
      
      for (let point = 0; zerosInFile < 20 && point < points; ++point) {
        extractors.forEach(extract => {
          if (extract(buffer, point) === 0) zerosInFile++;
        });
      }
      if (zerosInFile >= 20) filesWithNoRgb++;
    })
  );

  await Promise.all(tasks);

  if(filesWithNoRgb === files.length){
    scanColorOptionsResults.useIntensity = true;

    scanColorOptionsResults.intensityMinValue = Math.min.apply(Math, minValues);
    scanColorOptionsResults.intensityMaxValue = Math.max.apply(Math, maxValues);
  }else{
    scanColorOptionsResults.useRgb = true;
  }

  scanColorOptionsResults.scanned = true;
}
