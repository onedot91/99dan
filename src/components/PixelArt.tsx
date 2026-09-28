import { SpriteLayer } from './Sprite';
import type { SpriteMap } from './Sprite';
const TROPHY:SpriteMap=[
  '...oooooooooooooo...',
  '.ooohhyyyyyyyyyYooo.',
  'oyyohyyyyyyyyyyYoyyo',
  'oy.ohyyyoyyoyyyYo.yo',
  'oy.ohyyyyooyyyyYo.yo',
  'oy.ohyyyyooyyyyYo.yo',
  'oyyohyyyoyyoyyyYoyyo',
  '..oohyyyyyyyyyYYoo..',
  '...oohyyyyyyyYYoo...',
  '.....oohyyyYYoo.....',
  '........oyYo........',
  '........oyYo........',
  '......ohyyyyYo......',
  '.....oooooooooo.....',
  '....oaaaaaaaaaAo....',
  '....oAAAAAAAAAAo....',
  '....oooooooooooo....'
];
export function PixelArt({kind}:{readonly kind:'trophy'}){
  return <svg className={`pixel-art ${kind}`} viewBox="0 0 20 19" shapeRendering="crispEdges" aria-hidden="true">
    <rect className="pixel-shadow" x="3" y="18" width="14" height="1"/>
    <SpriteLayer className="trophy-body" map={TROPHY} x={0} y={0}/>
  </svg>;
}
