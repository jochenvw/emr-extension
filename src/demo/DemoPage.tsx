import { ControlPlane } from './ControlPlane';
import { Emr } from './Emr';
import { GuideBar } from './GuideBar';
import { Reveal } from './Reveal';
import { Surface } from './Surface';

export function DemoPage() {
  return (
    <div className="demo">
      <GuideBar />
      <div className="demo-split">
        <div className="demo-emr">
          <span className="plane-tag plane-rec floating">Record plane · EMR</span>
          <Emr />
        </div>
        <Surface />
      </div>
      <ControlPlane />
      <Reveal />
    </div>
  );
}
