var a="data-hive-node";function C(e,n,t){if(t===!1||t===""){e.removeAttribute(n);return}e.setAttribute(n,t===!0?"":String(t))}var w=new WeakMap;function A(e,n){let t=w.get(e);if(t)for(let r of t)r in n.props||e.removeAttribute(r);let o=new Set;for(let[r,i]of Object.entries(n.props))C(e,r,i),o.add(r);w.set(e,o),n.slot===void 0||n.slot===""?e.removeAttribute("slot"):e.setAttribute("slot",n.slot)}function f(e,n){for(n.forEach((t,o)=>{let r=e.children[o];r!==t&&e.insertBefore(t,r??null)});e.children.length>n.length;)e.lastElementChild?.remove()}function P(e){let n=new Map;for(let t of e.querySelectorAll(`[${a}]`))n.set(t.getAttribute(a),t);return n}function g(e,n,t){let o=t.get(n.id),r=o&&o.tagName.toLowerCase()===n.tag.toLowerCase()?o:e.createElement(n.tag);return r.setAttribute(a,n.id),A(r,n),f(r,n.children.map(i=>g(e,i,t))),r}var u="hive-overlay",y="#cc7958",L=`
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
  border: 1px solid color-mix(in oklab, ${y} 50%, transparent);
}
#${u} .hive-selected {
  border: 2px solid ${y};
}
#${u} .hive-chip {
  position: fixed;
  display: none;
  padding: 2px 6px;
  border-radius: 4px 4px 0 0;
  background: ${y};
  color: #fff;
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  #${u} .hive-box {
    transition: none;
  }
}
`;function E(e){for(let n of e){if(!(n instanceof Element))continue;let t=n.getAttribute(a);if(t!==null)return t}return null}function h(e,n){if(!n){e.style.display="none";return}let t=n.getBoundingClientRect();e.style.display="block",e.style.left=`${t.left}px`,e.style.top=`${t.top}px`,e.style.width=`${t.width}px`,e.style.height=`${t.height}px`}function I(e){let n=e.createElement("style");n.textContent=L;let t=e.createElement("div");t.id=u;let o=e.createElement("div");o.className="hive-box hive-hover";let r=e.createElement("div");r.className="hive-box hive-selected";let i=e.createElement("div");i.className="hive-chip",t.append(o,r,i);let d=null,c=null;function v(){if(h(r,c),!c){i.style.display="none";return}let l=c.getBoundingClientRect();i.textContent=c.tagName.toLowerCase(),i.style.display="block",i.style.left=`${l.left}px`,i.style.top=l.top>=18?`${l.top-18}px`:`${l.top}px`}return{mount(){e.head.appendChild(n),e.body.appendChild(t)},hover(l){d=l,h(o,d)},select(l){c=l,v()},refresh(){h(o,d),v()},dispose(){n.remove(),t.remove(),d=null,c=null}}}function N(e,n,t){if(!e||typeof e!="object")return null;let o=e;return typeof o.type!="string"||!t.includes(o.type)||typeof o.nonce!="string"||o.nonce!==n?null:e}var T="hive-stage",D=/^[0-9a-f]{64}$/;function k(e){let t=e.split("/").filter(o=>o!=="")[0];return t!==void 0&&D.test(t)?t:null}function $(e){let n=k(e.location.pathname)??"",t=e.document,o=t.createElement("div");o.id=T;let r=I(t),i=null;function d(s){return s===null?null:o.querySelector(`[${a}="${s}"]`)}function c(s){i=s,r.select(d(s))}function v(s){if(!s.root){o.replaceChildren();return}f(o,[g(t,s.root,P(o))]),r.select(d(i))}function l(s){let p=N(s.data,n,["render","select"]);p?.type==="render"&&v(p.document),p?.type==="select"&&c(p.componentId)}function x(s){let p=E(s.composedPath());c(p),e.parent.postMessage({type:"selected",nonce:n,componentId:p},"*")}function b(s){r.hover(d(E(s.composedPath())))}function m(){r.refresh()}return{start(){n!==""&&(e.addEventListener("message",l),t.addEventListener("click",x,!0),t.addEventListener("pointermove",b,!0),e.addEventListener("resize",m),e.addEventListener("scroll",m,!0),t.body.appendChild(o),r.mount(),e.parent.postMessage({type:"ready",nonce:n},"*"))},dispose(){e.removeEventListener("message",l),t.removeEventListener("click",x,!0),t.removeEventListener("pointermove",b,!0),e.removeEventListener("resize",m),e.removeEventListener("scroll",m,!0),r.dispose(),i=null,o.remove(),o=t.createElement("div"),o.id=T}}}$(window).start();
