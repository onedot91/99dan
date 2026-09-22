export type Cue='tap'|'correct'|'wrong'|'combo'|'finish'|'enable';
type Note={readonly hz:number;readonly at:number;readonly length:number;readonly wave:OscillatorType;readonly gain:number;readonly endHz?:number};
const note=(hz:number,at:number,length=.12):Note=>({hz,at,length,wave:'triangle',gain:.18});
const impact:Note={hz:210,endHz:52,at:0,length:.105,wave:'sine',gain:.30};
const cues:Readonly<Record<Cue,readonly Note[]>>={
  tap:[{hz:780,endHz:350,at:0,length:.045,wave:'triangle',gain:.10}],
  correct:[impact,{hz:1600,endHz:500,at:0,length:.035,wave:'triangle',gain:.12},note(523.25,0),note(659.25,.055),note(783.99,.11,.2)],
  wrong:[note(293.66,0,.14),note(261.63,.12,.2)],
  combo:[{...impact,gain:.38},{hz:2100,endHz:700,at:0,length:.045,wave:'triangle',gain:.16},note(523.25,0),note(659.25,.06),note(783.99,.12),note(1046.5,.18,.26),{hz:261.63,at:0,length:.35,wave:'sine',gain:.12}],
  finish:[note(523.25,0,.16),note(659.25,.13,.16),note(783.99,.26,.16),note(1046.5,.39,.4)],
  enable:[note(659.25,0,.09),note(783.99,.09,.16)]
};
export class GameAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private enabled=false;
  private voices=new Set<OscillatorNode>();
  private lastTap=0;
  async activate():Promise<void>{
    if(!this.context){
      this.context=new AudioContext();
      const filter=this.context.createBiquadFilter();
      filter.type='lowpass';filter.frequency.value=3200;
      const compressor=this.context.createDynamicsCompressor();
      compressor.threshold.value=-18;compressor.ratio.value=5;
      this.master=this.context.createGain();this.master.gain.value=.35;
      this.master.connect(filter);filter.connect(compressor);compressor.connect(this.context.destination);
    }
    await this.context.resume();
    this.enabled=true;
  }
  mute():void{
    this.enabled=false;
    for(const voice of this.voices)voice.stop();
    this.voices.clear();
  }
  play(cue:Cue):void{
    const context=this.context,master=this.master;
    if(!this.enabled||!context||!master||context.state!=='running'||document.hidden)return;
    if(cue==='tap'&&context.currentTime-this.lastTap<.055)return;
    if(cue==='tap')this.lastTap=context.currentTime;
    if(cue!=='tap'){for(const voice of this.voices)voice.stop();this.voices.clear();}
    for(const n of cues[cue]){
      if(this.voices.size>=10)break;
      const voice=context.createOscillator(),envelope=context.createGain();
      const start=context.currentTime+n.at;
      voice.type=n.wave;voice.frequency.setValueAtTime(n.hz,start);
      if(n.endHz!==undefined)voice.frequency.exponentialRampToValueAtTime(n.endHz,start+n.length);
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(n.gain,start+.008);
      envelope.gain.exponentialRampToValueAtTime(.001,start+n.length);
      voice.connect(envelope);envelope.connect(master);
      this.voices.add(voice);
      voice.onended=()=>{this.voices.delete(voice);voice.disconnect();envelope.disconnect();};
      voice.start(start);voice.stop(start+n.length+.01);
    }
  }
  async dispose():Promise<void>{this.mute();await this.context?.close();this.context=null;this.master=null;}
}
