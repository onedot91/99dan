export function PixelArt({kind='hero'}:{readonly kind?:'hero'|'trophy'}){
  return <svg className={`pixel-art ${kind}`} viewBox="0 0 160 112" shapeRendering="crispEdges" aria-hidden="true">
    {kind==='hero'?<>
      <path className="pixel-shadow" d="M28 96h104v8H28z"/>
      <path className="pixel-dark" d="M48 16h64v8h8v56h-8v8H48v-8h-8V24h8zM48 88h16v8H40v-8zm48 0h16v8H88v-8z"/>
      <path className="pixel-mint" d="M48 24h64v56H48zM32 44h8v24h-8zM120 44h8v24h-8z"/>
      <path className="pixel-light" d="M48 24h64v8H48zM48 32h8v32h-8z"/>
      <path className="pixel-dark" d="M60 44h8v12h-8zm32 0h8v12h-8zM68 64h24v8H68z"/>
      <path className="pixel-coral" d="M52 56h8v8h-8zm48 0h8v8h-8z"/>
      <path className="pixel-yellow" d="M76 0h8v8h-8zm-8 8h24v8H68zM12 32h8v8h8v8h-8v8h-8v-8H4v-8h8zm124-16h8v8h8v8h-8v8h-8v-8h-8v-8h8z"/>
    </>:<>
      <path className="pixel-shadow" d="M40 100h80v8H40z"/>
      <path className="pixel-yellow" d="M48 12h64v48H48zM32 20h16v8H32zm-8 8h8v24h-8zm8 24h16v8H32zm80-32h16v8h-16zm16 8h8v24h-8zm-16 24h16v8h-16zM56 60h48v8H56zm16 8h16v24H72zM56 92h48v8H56z"/>
      <path className="pixel-light" d="M48 12h64v8H48zM56 20h8v32h-8z"/>
      <path className="pixel-dark" d="M76 28h8v8h8v8h-8v8h-8v-8h-8v-8h8z"/>
    </>}
  </svg>;
}
