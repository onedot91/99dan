export type Cue='tap'|'correct'|'wrong'|'combo'|'finish'|'record'|'levelup'|'friend'|'enable';
type Wave='pulse'|'square'|'triangle'|'noise';
type Note={readonly midi:number;readonly at:number;readonly length:number;readonly wave:Wave;readonly gain:number;readonly slide?:number};
// 16-bit style chiptune: pulse leads, triangle bass, short noise hits. `step` transposes by semitones.
const lead=(midi:number,at:number,length=.08,gain=.13):Note=>({midi,at,length,wave:'pulse',gain});
const bass=(midi:number,at:number,length=.14):Note=>({midi,at,length,wave:'triangle',gain:.22});
const hit=(at=0,gain=.09):Note=>({midi:0,at,length:.035,wave:'noise',gain});
const arp=(midis:readonly number[],from:number,gap:number,length=.07,gain=.12)=>midis.map((m,i)=>lead(m,from+i*gap,length,gain));
// Combo ladder climbs do-re-mi-fa-sol, so each streak of five sounds like a finished phrase.
export const COMBO_LADDER=[0,2,4,5,7] as const;
const cues:Readonly<Record<Cue,(step:number)=>readonly Note[]>>={
  tap:()=>[{midi:88,at:0,length:.03,wave:'square',gain:.045,slide:-12}],
  correct:step=>[hit(),bass(48+step,0,.1),lead(79+step,0,.055),lead(84+step,.055,.16,.14)],
  combo:step=>[hit(0,.12),bass(48+step,0,.3),...arp([72,76,79,84,88].map(m=>m+step),0,.045,.09),lead(91+step,.225,.26,.12),{midi:96+step,at:.225,length:.2,wave:'square',gain:.035}],
  wrong:()=>[{midi:62,at:0,length:.12,wave:'triangle',gain:.2,slide:-2},{midi:57,at:.11,length:.18,wave:'triangle',gain:.18,slide:-3}],
  finish:()=>[...arp([67,72,76,79],0,.09,.08),lead(84,.36,.42,.14),bass(48,.36,.42),bass(36,.36,.42)],
  record:()=>[hit(),...arp([72,76,79,84],0,.07,.07),...arp([76,79,84,88],.3,.07,.07),hit(.58,.1),lead(91,.6,.12),lead(88,.72,.12),lead(91,.84,.5,.15),bass(43,.6,.25),bass(48,.84,.5)],
  levelup:()=>[...arp([72,74,76,77,79,81,83],0,.045,.06,.1),hit(.32,.1),lead(84,.32,.18,.14),lead(88,.5,.18,.14),lead(91,.68,.4,.15),bass(48,.32,.36),bass(55,.68,.4)],
  friend:()=>[hit(0,.08),...arp([79,83,86,91],0,.06,.07,.11),lead(95,.24,.32,.12),bass(55,.24,.3),{midi:98,at:.3,length:.2,wave:'square',gain:.03}],
  enable:()=>[lead(76,0,.07),lead(83,.07,.14)]
};
const hz=(midi:number)=>440*2**((midi-69)/12);
export class GameAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private pulse:PeriodicWave|null=null;
  private noise:AudioBuffer|null=null;
  private enabled=false;
  private voices=new Set<AudioScheduledSourceNode>();
  private lastTap=0;
  async activate():Promise<void>{
    if(!this.context){
      const context=new AudioContext();this.context=context;
      // 25% duty pulse wave, the signature lead of 16-bit consoles.
      const size=32,real=new Float32Array(size),imag=new Float32Array(size);
      for(let n=1;n<size;n++)real[n]=2*Math.sin(Math.PI*n*.25)/(Math.PI*n);
      this.pulse=context.createPeriodicWave(real,imag);
      this.noise=context.createBuffer(1,Math.floor(context.sampleRate*.1),context.sampleRate);
      const data=this.noise.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const filter=context.createBiquadFilter();
      filter.type='lowpass';filter.frequency.value=4200;
      const compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-18;compressor.ratio.value=5;
      this.master=context.createGain();this.master.gain.value=.32;
      this.master.connect(filter);filter.connect(compressor);compressor.connect(context.destination);
    }
    await this.context.resume();
    this.enabled=true;
  }
  mute():void{
    this.enabled=false;
    for(const voice of this.voices)voice.stop();
    this.voices.clear();
  }
  play(cue:Cue,step=0):void{
    const context=this.context,master=this.master;
    if(!this.enabled||!context||!master||context.state!=='running'||document.hidden)return;
    if(cue==='tap'&&context.currentTime-this.lastTap<.055)return;
    if(cue==='tap')this.lastTap=context.currentTime;
    if(cue!=='tap'){for(const voice of this.voices)voice.stop();this.voices.clear();}
    for(const n of cues[cue](step)){
      if(this.voices.size>=24)break;
      const envelope=context.createGain();
      const start=context.currentTime+.005+n.at;
      let voice:AudioScheduledSourceNode;
      if(n.wave==='noise'){
        const source=context.createBufferSource();source.buffer=this.noise;voice=source;
      }else{
        const osc=context.createOscillator();
        if(n.wave==='pulse'&&this.pulse)osc.setPeriodicWave(this.pulse);else osc.type=n.wave==='pulse'?'square':n.wave;
        osc.frequency.setValueAtTime(hz(n.midi),start);
        if(n.slide)osc.frequency.exponentialRampToValueAtTime(hz(n.midi+n.slide),start+n.length);
        voice=osc;
      }
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(n.gain,start+.004);
      envelope.gain.setValueAtTime(n.gain,start+n.length*.6);
      envelope.gain.exponentialRampToValueAtTime(.001,start+n.length);
      voice.connect(envelope);envelope.connect(master);
      this.voices.add(voice);
      voice.onended=()=>{this.voices.delete(voice);voice.disconnect();envelope.disconnect();};
      voice.start(start);voice.stop(start+n.length+.01);
    }
  }
  async dispose():Promise<void>{this.mute();await this.context?.close();this.context=null;this.master=null;}
}
