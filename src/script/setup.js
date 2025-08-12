// src/script/setup.js
import { ScriptPlayer } from './player.js';
import { refs } from '../core/state.js';
import { startVoteOnce } from '../vote.js';
import { showCaption, speak } from '../ui/captionTTS.js';

export function setupScriptForNode(nodeId, simRT, content){
  if (refs.scriptPlayer) { try{ refs.scriptPlayer.stop(); }catch(_){} }

  const steps = Array.isArray(content.script) ? content.script
              : Array.isArray(content.roteiro) ? content.roteiro
              : [];

  refs.scriptPlayer = new ScriptPlayer({
    nodeId,
    simGroup: simRT.group,
    simAPI: simRT.group?.userData?.api,
    simCamera: simRT.camera,
    setText: (s)=>{ showCaption(refs.captionBar, s); speak(s); },
    setStatus: (s)=>{ refs.scriptStatus.textContent = s || ''; },
    onEnd: ()=> startVoteOnce(nodeId)
  });

  refs.scriptPlayer.load(steps);
  refs.scriptPlayer.play();
}
