import * as Bounds from "../src/bounds";
import * as Constants from "../src/constants";
import * as Key from "../src/key";
import * as Srs from "../src/srs";
import * as Tile from "../src/tile";

const geometricErrorDivisor = Constants.geometricErrorDivisor;
const srs = Srs.create("EPSG:4978");

test("basic root tile transformation", async () => {
  const key = Key.create();
  const hierarchy = { "0-0-0-0": 1000 };
  const ept = { srs, bounds: [0, 0, 0, 10, 10, 10] };

  const tile = await Tile.translate({ key, ept, hierarchy });
  expect(tile).toEqual({
    asset: { version: "1.0" },
    geometricError: Bounds.width(ept.bounds) / geometricErrorDivisor,
    root: {
      content: { uri: "0-0-0-0.pnts" },
      boundingVolume: { box: Bounds.boxify(ept.bounds) },
      geometricError: Bounds.width(ept.bounds) / geometricErrorDivisor,
      refine: "ADD",
    },
  });
});

test("truncated root tile transformation", async () => {
  const key = Key.create();
  const hierarchy = {
    "0-0-0-0": 1000,
    "1-1-1-1": -1,
  };
  const ept = { srs, bounds: [0, 0, 0, 10, 10, 10] };
  const rootGeometricError = Bounds.width(ept.bounds) / geometricErrorDivisor;

  const tile = await Tile.translate({ key, ept, hierarchy });
  expect(tile).toEqual({
    asset: { version: "1.0" },
    geometricError: rootGeometricError,
    root: {
      content: { uri: "0-0-0-0.pnts" },
      boundingVolume: { box: Bounds.boxify(ept.bounds) },
      geometricError: rootGeometricError,
      refine: "ADD",
      children: [
        {
          content: { uri: "1-1-1-1.json" },
          geometricError: rootGeometricError / 2,
          boundingVolume: {
            box:
              ept.bounds |> ((v) => Bounds.step(v, [1, 1, 1])) |> Bounds.boxify,
          },
        },
      ],
    },
  });
});

test("subtree tile transformation", async () => {
  const key = Key.create(1, 1, 1, 1);
  const hierarchy = {
    "1-1-1-1": 1,
    "2-2-2-2": 2,
    "3-4-4-4": -1,
  };
  const ept = { srs, bounds: [0, 0, 0, 20, 20, 20] };
  const rootGeometricError = Bounds.width(ept.bounds) / geometricErrorDivisor;

  const tile = await Tile.translate({ key, ept, hierarchy });
  expect(tile).toEqual({
    asset: { version: "1.0" },
    geometricError: rootGeometricError / 2,
    root: {
      content: { uri: "1-1-1-1.pnts" },
      geometricError: rootGeometricError / 2,
      boundingVolume: {
        box: ept.bounds |> ((v) => Bounds.step(v, [1, 1, 1])) |> Bounds.boxify,
      },
      children: [
        {
          content: { uri: "2-2-2-2.pnts" },
          geometricError: rootGeometricError / 4,
          boundingVolume: {
            box:
              ept.bounds
              |> ((v) => Bounds.step(v, [1, 1, 1]))
              |> ((v) => Bounds.step(v, [0, 0, 0]))
              |> Bounds.boxify,
          },
          children: [
            {
              content: { uri: "3-4-4-4.json" },
              geometricError: rootGeometricError / 8,
              boundingVolume: {
                box:
                  ept.bounds
                  |> ((v) => Bounds.step(v, [1, 1, 1]))
                  |> ((v) => Bounds.step(v, [0, 0, 0]))
                  |> ((v) => Bounds.step(v, [0, 0, 0]))
                  |> Bounds.boxify,
              },
            },
          ],
        },
      ],
    },
  });
});
