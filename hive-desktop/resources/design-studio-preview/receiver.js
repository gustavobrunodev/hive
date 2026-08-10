var v="data-hive-node";function S(e,n,t){if(t===!1||t===""){e.removeAttribute(n);return}e.setAttribute(n,t===!0?"":String(t))}var I=new WeakMap;function k(e,n){let t=I.get(e);if(t)for(let r of t)r in n.props||e.removeAttribute(r);let o=new Set;for(let[r,s]of Object.entries(n.props))S(e,r,s),o.add(r);I.set(e,o),n.slot===void 0||n.slot===""?e.removeAttribute("slot"):e.setAttribute("slot",n.slot)}function b(e,n){for(n.forEach((t,o)=>{let r=e.children[o];r!==t&&e.insertBefore(t,r??null)});e.children.length>n.length;)e.lastElementChild?.remove()}function $(e){let n=new Map;for(let t of e.querySelectorAll(`[${v}]`))n.set(t.getAttribute(v),t);return n}function P(e,n,t){let o=t.get(n.id),r=o&&o.tagName.toLowerCase()===n.tag.toLowerCase()?o:e.createElement(n.tag);return r.setAttribute(v,n.id),k(r,n),b(r,n.children.map(s=>P(e,s,t))),r}var u="hive-overlay",h="#cc7958",D=`
#${u} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
}
#${u} .hive-box {
  position: fixed;
  display: none;
  box-sizing: border-box;
  transition: opacity 120ms ease-out;
}
#${u} .hive-hover {
  border: 1px solid color-mix(in oklab, ${h} 50%, transparent);
}
#${u} .hive-selected {
  border: 2px solid ${h};
}
#${u} .hive-pulse {
  border: 2px solid ${h};
  animation: hive-pulse 600ms ease-out;
}
@keyframes hive-pulse {
  from { opacity: 1; }
  to { opacity: 0; }
}
#${u} .hive-chip {
  position: fixed;
  display: none;
  padding: 2px 6px;
  border-radius: 4px 4px 0 0;
  background: ${h};
  color: #fff;
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  #${u} .hive-box {
    transition: none;
  }
  #${u} .hive-pulse {
    animation: none;
  }
}
`;function T(e){for(let n of e){if(!(n instanceof Element))continue;let t=n.getAttribute(v);if(t!==null)return t}return null}function E(e,n){if(!n){e.style.display="none";return}let t=n.getBoundingClientRect();e.style.display="block",e.style.left=`${t.left}px`,e.style.top=`${t.top}px`,e.style.width=`${t.width}px`,e.style.height=`${t.height}px`}function N(e){let n=e.createElement("style");n.textContent=D;let t=e.createElement("div");t.id=u;let o=e.createElement("div");o.className="hive-box hive-hover";let r=e.createElement("div");r.className="hive-box hive-selected";let s=e.createElement("div");s.className="hive-chip",t.append(o,r,s);let c=null,p=null,a=[];function g(){if(E(r,p),!p){s.style.display="none";return}let l=p.getBoundingClientRect();s.textContent=p.tagName.toLowerCase(),s.style.display="block",s.style.left=`${l.left}px`,s.style.top=l.top>=18?`${l.top-18}px`:`${l.top}px`}return{mount(){e.head.appendChild(n),e.body.appendChild(t)},hover(l){c=l,E(o,c)},pulse(l){for(let f of a)f.remove();a=l.map(f=>{let m=e.createElement("div");return m.className="hive-box hive-pulse",E(m,f),t.appendChild(m),m})},select(l){p=l,g()},refresh(){E(o,c),g()},dispose(){n.remove(),t.remove();for(let l of a)l.remove();a=[],c=null,p=null}}}function C(e,n,t){if(!e||typeof e!="object")return null;let o=e;return typeof o.type!="string"||!t.includes(o.type)||typeof o.nonce!="string"||o.nonce!==n?null:e}var L="hive-stage",M=/^[0-9a-f]{64}$/,R=600;function O(e){let t=e.split("/").filter(o=>o!=="")[0];return t!==void 0&&M.test(t)?t:null}function A(e){let n=O(e.location.pathname)??"",t=e.document,o=t.createElement("div");o.id=L;let r=N(t),s=null,c=null;function p(i){return i===null?null:o.querySelector(`[${v}="${i}"]`)}function a(i){s=i,r.select(p(i))}function g(i){if(!i.root){o.replaceChildren();return}b(o,[P(t,i.root,$(o))]),r.select(p(s))}function l(i){if(e.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;c!==null&&e.clearTimeout(c);let d=i.map(x=>p(x)).filter(x=>x!==null);r.pulse(d),c=e.setTimeout(()=>r.pulse([]),R)}function f(i){let d=C(i.data,n,["render","select","pulse"]);d?.type==="render"&&g(d.document),d?.type==="pulse"&&l(d.componentIds),d?.type==="select"&&a(d.componentId)}function m(i){let d=T(i.composedPath());a(d),e.parent.postMessage({type:"selected",nonce:n,componentId:d},"*")}function w(i){r.hover(p(T(i.composedPath())))}function y(){r.refresh()}return{start(){n!==""&&(e.addEventListener("message",f),t.addEventListener("click",m,!0),t.addEventListener("pointermove",w,!0),e.addEventListener("resize",y),e.addEventListener("scroll",y,!0),t.body.appendChild(o),r.mount(),e.parent.postMessage({type:"ready",nonce:n},"*"))},dispose(){e.removeEventListener("message",f),t.removeEventListener("click",m,!0),t.removeEventListener("pointermove",w,!0),e.removeEventListener("resize",y),e.removeEventListener("scroll",y,!0),c!==null&&e.clearTimeout(c),c=null,r.dispose(),s=null,o.remove(),o=t.createElement("div"),o.id=L}}}A(window).start();
