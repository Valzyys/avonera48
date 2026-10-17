import { Curtain } from "../ui/Curtain";
import { at, SceneFrame, Typed, type SceneProps } from "./common";

/** 0–10 s: a beam sweeps the drapes, the greeting is unmasked, the promise types itself out. */
export function Opening({ dur, greeting }: SceneProps) {
  return (
    <SceneFrame id="opening" dur={dur}>
      <Curtain />
      <span className="ps-sweep" style={at(0.2)} aria-hidden />
      <div className="ps-center">
        <h2 className="ps-greet ps-a ps-a--mask" style={at(1.4)}>
          Selamat <em>{greeting}</em>
        </h2>
        <Typed className="ps-sub" text="Show akan segera dimulai" start={3.4} />
      </div>
    </SceneFrame>
  );
}
