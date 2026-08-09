var uh=Object.defineProperty;var mh=(t,e)=>{for(var o in e)uh(t,o,{get:e[o],enumerable:!0})};var ss=class extends Event{constructor(t){super("wa-collapse",{bubbles:!0,cancelable:!0,composed:!0}),this.detail=t}};var ns=class extends Event{constructor(t){super("wa-expand",{bubbles:!0,cancelable:!0,composed:!0}),this.detail=t}};var ls=class extends Event{constructor(t){super("wa-after-collapse",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var cs=class extends Event{constructor(t){super("wa-after-expand",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Vi=globalThis,qi=Vi.ShadowRoot&&(Vi.ShadyCSS===void 0||Vi.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Vr=Symbol(),hs=new WeakMap,ni=class{constructor(e,o,i){if(this._$cssResult$=!0,i!==Vr)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=o}get styleSheet(){let e=this.o,o=this.t;if(qi&&e===void 0){let i=o!==void 0&&o.length===1;i&&(e=hs.get(o)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&hs.set(o,e))}return e}toString(){return this.cssText}},ds=t=>new ni(typeof t=="string"?t:t+"",void 0,Vr),C=(t,...e)=>{let o=t.length===1?t[0]:e.reduce((i,r,s)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+t[s+1],t[0]);return new ni(o,t,Vr)},ps=(t,e)=>{if(qi)t.adoptedStyleSheets=e.map(o=>o instanceof CSSStyleSheet?o:o.styleSheet);else for(let o of e){let i=document.createElement("style"),r=Vi.litNonce;r!==void 0&&i.setAttribute("nonce",r),i.textContent=o.cssText,t.appendChild(i)}},qr=qi?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let o="";for(let i of e.cssRules)o+=i.cssText;return ds(o)})(t):t;var{is:fh,defineProperty:gh,getOwnPropertyDescriptor:bh,getOwnPropertyNames:vh,getOwnPropertySymbols:wh,getPrototypeOf:yh}=Object,Wi=globalThis,us=Wi.trustedTypes,xh=us?us.emptyScript:"",Ch=Wi.reactiveElementPolyfillSupport,li=(t,e)=>t,ci={toAttribute(t,e){switch(e){case Boolean:t=t?xh:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let o=t;switch(e){case Boolean:o=t!==null;break;case Number:o=t===null?null:Number(t);break;case Object:case Array:try{o=JSON.parse(t)}catch{o=null}}return o}},Ni=(t,e)=>!fh(t,e),ms={attribute:!0,type:String,converter:ci,reflect:!1,useDefault:!1,hasChanged:Ni};Symbol.metadata??=Symbol("metadata"),Wi.litPropertyMetadata??=new WeakMap;var Ue=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,o=ms){if(o.state&&(o.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((o=Object.create(o)).wrapped=!0),this.elementProperties.set(e,o),!o.noAccessor){let i=Symbol(),r=this.getPropertyDescriptor(e,i,o);r!==void 0&&gh(this.prototype,e,r)}}static getPropertyDescriptor(e,o,i){let{get:r,set:s}=bh(this.prototype,e)??{get(){return this[o]},set(n){this[o]=n}};return{get:r,set(n){let c=r?.call(this);s?.call(this,n),this.requestUpdate(e,c,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??ms}static _$Ei(){if(this.hasOwnProperty(li("elementProperties")))return;let e=yh(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(li("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(li("properties"))){let o=this.properties,i=[...vh(o),...wh(o)];for(let r of i)this.createProperty(r,o[r])}let e=this[Symbol.metadata];if(e!==null){let o=litPropertyMetadata.get(e);if(o!==void 0)for(let[i,r]of o)this.elementProperties.set(i,r)}this._$Eh=new Map;for(let[o,i]of this.elementProperties){let r=this._$Eu(o,i);r!==void 0&&this._$Eh.set(r,o)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let o=[];if(Array.isArray(e)){let i=new Set(e.flat(1/0).reverse());for(let r of i)o.unshift(qr(r))}else e!==void 0&&o.push(qr(e));return o}static _$Eu(e,o){let i=o.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,o=this.constructor.elementProperties;for(let i of o.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return ps(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,o,i){this._$AK(e,i)}_$ET(e,o){let i=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,i);if(r!==void 0&&i.reflect===!0){let s=(i.converter?.toAttribute!==void 0?i.converter:ci).toAttribute(o,i.type);this._$Em=e,s==null?this.removeAttribute(r):this.setAttribute(r,s),this._$Em=null}}_$AK(e,o){let i=this.constructor,r=i._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let s=i.getPropertyOptions(r),n=typeof s.converter=="function"?{fromAttribute:s.converter}:s.converter?.fromAttribute!==void 0?s.converter:ci;this._$Em=r;let c=n.fromAttribute(o,s.type);this[r]=c??this._$Ej?.get(r)??c,this._$Em=null}}requestUpdate(e,o,i,r=!1,s){if(e!==void 0){let n=this.constructor;if(r===!1&&(s=this[e]),i??=n.getPropertyOptions(e),!((i.hasChanged??Ni)(s,o)||i.useDefault&&i.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,i))))return;this.C(e,o,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,o,{useDefault:i,reflect:r,wrapped:s},n){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,n??o??this[e]),s!==!0||n!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(o=void 0),this._$AL.set(e,o)),r===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(o){Promise.reject(o)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[r,s]of this._$Ep)this[r]=s;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[r,s]of i){let{wrapped:n}=s,c=this[r];n!==!0||this._$AL.has(r)||c===void 0||this.C(r,void 0,s,c)}}let e=!1,o=this._$AL;try{e=this.shouldUpdate(o),e?(this.willUpdate(o),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(o)):this._$EM()}catch(i){throw e=!1,this._$EM(),i}e&&this._$AE(o)}willUpdate(e){}_$AE(e){this._$EO?.forEach(o=>o.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(o=>this._$ET(o,this[o])),this._$EM()}updated(e){}firstUpdated(e){}};Ue.elementStyles=[],Ue.shadowRootOptions={mode:"open"},Ue[li("elementProperties")]=new Map,Ue[li("finalized")]=new Map,Ch?.({ReactiveElement:Ue}),(Wi.reactiveElementVersions??=[]).push("2.1.2");var Nr=globalThis,fs=t=>t,Hi=Nr.trustedTypes,gs=Hi?Hi.createPolicy("lit-html",{createHTML:t=>t}):void 0,Hr="$lit$",je=`lit$${Math.random().toFixed(9).slice(2)}$`,Ur="?"+je,kh=`<${Ur}>`,zo=document,di=()=>zo.createComment(""),pi=t=>t===null||typeof t!="object"&&typeof t!="function",jr=Array.isArray,Cs=t=>jr(t)||typeof t?.[Symbol.iterator]=="function",Wr=`[ 	
\f\r]`,hi=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,bs=/-->/g,vs=/>/g,ko=RegExp(`>|${Wr}(?:([^\\s"'>=/]+)(${Wr}*=${Wr}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ws=/'/g,ys=/"/g,ks=/^(?:script|style|textarea|title)$/i,Kr=t=>(e,...o)=>({_$litType$:t,strings:e,values:o}),p=Kr(1),Ss=Kr(2),zs=Kr(3),Ot=Symbol.for("lit-noChange"),lt=Symbol.for("lit-nothing"),xs=new WeakMap,So=zo.createTreeWalker(zo,129);function Es(t,e){if(!jr(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return gs!==void 0?gs.createHTML(e):e}var Ls=(t,e)=>{let o=t.length-1,i=[],r,s=e===2?"<svg>":e===3?"<math>":"",n=hi;for(let c=0;c<o;c++){let h=t[c],d,u,b=-1,f=0;for(;f<h.length&&(n.lastIndex=f,u=n.exec(h),u!==null);)f=n.lastIndex,n===hi?u[1]==="!--"?n=bs:u[1]!==void 0?n=vs:u[2]!==void 0?(ks.test(u[2])&&(r=RegExp("</"+u[2],"g")),n=ko):u[3]!==void 0&&(n=ko):n===ko?u[0]===">"?(n=r??hi,b=-1):u[1]===void 0?b=-2:(b=n.lastIndex-u[2].length,d=u[1],n=u[3]===void 0?ko:u[3]==='"'?ys:ws):n===ys||n===ws?n=ko:n===bs||n===vs?n=hi:(n=ko,r=void 0);let g=n===ko&&t[c+1].startsWith("/>")?" ":"";s+=n===hi?h+kh:b>=0?(i.push(d),h.slice(0,b)+Hr+h.slice(b)+je+g):h+je+(b===-2?c:g)}return[Es(t,s+(t[o]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]},ui=class t{constructor({strings:e,_$litType$:o},i){let r;this.parts=[];let s=0,n=0,c=e.length-1,h=this.parts,[d,u]=Ls(e,o);if(this.el=t.createElement(d,i),So.currentNode=this.el.content,o===2||o===3){let b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(r=So.nextNode())!==null&&h.length<c;){if(r.nodeType===1){if(r.hasAttributes())for(let b of r.getAttributeNames())if(b.endsWith(Hr)){let f=u[n++],g=r.getAttribute(b).split(je),v=/([.?@])?(.*)/.exec(f);h.push({type:1,index:s,name:v[2],strings:g,ctor:v[1]==="."?ji:v[1]==="?"?Ki:v[1]==="@"?Xi:Lo}),r.removeAttribute(b)}else b.startsWith(je)&&(h.push({type:6,index:s}),r.removeAttribute(b));if(ks.test(r.tagName)){let b=r.textContent.split(je),f=b.length-1;if(f>0){r.textContent=Hi?Hi.emptyScript:"";for(let g=0;g<f;g++)r.append(b[g],di()),So.nextNode(),h.push({type:2,index:++s});r.append(b[f],di())}}}else if(r.nodeType===8)if(r.data===Ur)h.push({type:2,index:s});else{let b=-1;for(;(b=r.data.indexOf(je,b+1))!==-1;)h.push({type:7,index:s}),b+=je.length-1}s++}}static createElement(e,o){let i=zo.createElement("template");return i.innerHTML=e,i}};function Eo(t,e,o=t,i){if(e===Ot)return e;let r=i!==void 0?o._$Co?.[i]:o._$Cl,s=pi(e)?void 0:e._$litDirective$;return r?.constructor!==s&&(r?._$AO?.(!1),s===void 0?r=void 0:(r=new s(t),r._$AT(t,o,i)),i!==void 0?(o._$Co??=[])[i]=r:o._$Cl=r),r!==void 0&&(e=Eo(t,r._$AS(t,e.values),r,i)),e}var Ui=class{constructor(e,o){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=o}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:o},parts:i}=this._$AD,r=(e?.creationScope??zo).importNode(o,!0);So.currentNode=r;let s=So.nextNode(),n=0,c=0,h=i[0];for(;h!==void 0;){if(n===h.index){let d;h.type===2?d=new Wo(s,s.nextSibling,this,e):h.type===1?d=new h.ctor(s,h.name,h.strings,this,e):h.type===6&&(d=new Yi(s,this,e)),this._$AV.push(d),h=i[++c]}n!==h?.index&&(s=So.nextNode(),n++)}return So.currentNode=zo,r}p(e){let o=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,o),o+=i.strings.length-2):i._$AI(e[o])),o++}},Wo=class t{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,o,i,r){this.type=2,this._$AH=lt,this._$AN=void 0,this._$AA=e,this._$AB=o,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,o=this._$AM;return o!==void 0&&e?.nodeType===11&&(e=o.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,o=this){e=Eo(this,e,o),pi(e)?e===lt||e==null||e===""?(this._$AH!==lt&&this._$AR(),this._$AH=lt):e!==this._$AH&&e!==Ot&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Cs(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==lt&&pi(this._$AH)?this._$AA.nextSibling.data=e:this.T(zo.createTextNode(e)),this._$AH=e}$(e){let{values:o,_$litType$:i}=e,r=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=ui.createElement(Es(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(o);else{let s=new Ui(r,this),n=s.u(this.options);s.p(o),this.T(n),this._$AH=s}}_$AC(e){let o=xs.get(e.strings);return o===void 0&&xs.set(e.strings,o=new ui(e)),o}k(e){jr(this._$AH)||(this._$AH=[],this._$AR());let o=this._$AH,i,r=0;for(let s of e)r===o.length?o.push(i=new t(this.O(di()),this.O(di()),this,this.options)):i=o[r],i._$AI(s),r++;r<o.length&&(this._$AR(i&&i._$AB.nextSibling,r),o.length=r)}_$AR(e=this._$AA.nextSibling,o){for(this._$AP?.(!1,!0,o);e!==this._$AB;){let i=fs(e).nextSibling;fs(e).remove(),e=i}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},Lo=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,o,i,r,s){this.type=1,this._$AH=lt,this._$AN=void 0,this.element=e,this.name=o,this._$AM=r,this.options=s,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=lt}_$AI(e,o=this,i,r){let s=this.strings,n=!1;if(s===void 0)e=Eo(this,e,o,0),n=!pi(e)||e!==this._$AH&&e!==Ot,n&&(this._$AH=e);else{let c=e,h,d;for(e=s[0],h=0;h<s.length-1;h++)d=Eo(this,c[i+h],o,h),d===Ot&&(d=this._$AH[h]),n||=!pi(d)||d!==this._$AH[h],d===lt?e=lt:e!==lt&&(e+=(d??"")+s[h+1]),this._$AH[h]=d}n&&!r&&this.j(e)}j(e){e===lt?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},ji=class extends Lo{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===lt?void 0:e}},Ki=class extends Lo{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==lt)}},Xi=class extends Lo{constructor(e,o,i,r,s){super(e,o,i,r,s),this.type=5}_$AI(e,o=this){if((e=Eo(this,e,o,0)??lt)===Ot)return;let i=this._$AH,r=e===lt&&i!==lt||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,s=e!==lt&&(i===lt||r);r&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Yi=class{constructor(e,o,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=o,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){Eo(this,e)}},$s={M:Hr,P:je,A:Ur,C:1,L:Ls,R:Ui,D:Cs,V:Eo,I:Wo,H:Lo,N:Ki,U:Xi,B:ji,F:Yi},Sh=Nr.litHtmlPolyfillSupport;Sh?.(ui,Wo),(Nr.litHtmlVersions??=[]).push("3.3.3");var As=(t,e,o)=>{let i=o?.renderBefore??e,r=i._$litPart$;if(r===void 0){let s=o?.renderBefore??null;i._$litPart$=r=new Wo(e.insertBefore(di(),s),s,void 0,o??{})}return r._$AI(t),r};var Xr=globalThis,eo=class extends Ue{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let o=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=As(o,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Ot}};eo._$litElement$=!0,eo.finalized=!0,Xr.litElementHydrateSupport?.({LitElement:eo});var zh=Xr.litElementPolyfillSupport;zh?.({LitElement:eo});(Xr.litElementVersions??=[]).push("4.2.2");var _s=C`
  @layer wa-component {
    :host {
      display: block;
      border: var(--wa-panel-border-width) var(--wa-panel-border-style) var(--wa-color-surface-border);
      border-radius: var(--wa-panel-border-radius);
      overflow: hidden;
    }

    /* Appearance modifiers */
    :host([appearance='outlined']) {
      background-color: var(--wa-color-surface-default);
      border-color: var(--wa-color-surface-border);
    }

    :host([appearance='filled']) {
      border-color: transparent;
    }

    :host([appearance='filled-outlined']) {
      background-color: var(--wa-color-neutral-fill-quiet);
      border-color: var(--wa-color-neutral-border-quiet);
    }

    :host([appearance='plain']) {
      background-color: transparent;
      border-color: transparent;
      border-radius: 0;
    }
  }
`;function y(t,e){let o={waitUntilFirstUpdate:!1,...e};return(i,r)=>{let{update:s}=i,n=Array.isArray(t)?t:[t];i.update=function(c){n.forEach(h=>{let d=h;if(c.has(d)){let u=c.get(d),b=this[d];u!==b&&(!o.waitUntilFirstUpdate||this.hasUpdated)&&this[r](u,b)}}),s.call(this,c)}}}var Eh=Object.defineProperty,Lh=Object.getOwnPropertyDescriptor,Ts=t=>{throw TypeError(t)},a=(t,e,o,i)=>{for(var r=i>1?void 0:i?Lh(e,o):e,s=t.length-1,n;s>=0;s--)(n=t[s])&&(r=(i?n(e,o,r):n(r))||r);return i&&r&&Eh(e,o,r),r},Ms=(t,e,o)=>e.has(t)||Ts("Cannot "+o),Is=(t,e,o)=>(Ms(t,e,"read from private field"),o?o.call(t):e.get(t)),Ds=(t,e,o)=>e.has(t)?Ts("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,o),Rs=(t,e,o,i)=>(Ms(t,e,"write to private field"),i?i.call(t,o):e.set(t,o),o);var k=t=>(e,o)=>{o!==void 0?o.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)};var $h={attribute:!0,type:String,converter:ci,reflect:!1,hasChanged:Ni},Ah=(t=$h,e,o)=>{let{kind:i,metadata:r}=o,s=globalThis.litPropertyMetadata.get(r);if(s===void 0&&globalThis.litPropertyMetadata.set(r,s=new Map),i==="setter"&&((t=Object.create(t)).wrapped=!0),s.set(o.name,t),i==="accessor"){let{name:n}=o;return{set(c){let h=e.get.call(this);e.set.call(this,c),this.requestUpdate(n,h,t,!0,c)},init(c){return c!==void 0&&this.C(n,void 0,t,c),c}}}if(i==="setter"){let{name:n}=o;return function(c){let h=this[n];e.call(this,c),this.requestUpdate(n,h,t,!0,c)}}throw Error("Unsupported decorator location: "+i)};function l(t){return(e,o)=>typeof o=="object"?Ah(t,e,o):((i,r,s)=>{let n=r.hasOwnProperty(s);return r.constructor.createProperty(s,i),n?Object.getOwnPropertyDescriptor(r,s):void 0})(t,e,o)}function A(t){return l({...t,state:!0,attribute:!1})}function No(t){return(e,o)=>{let i=typeof e=="function"?e:e[o];Object.assign(i,t)}}var oo=(t,e,o)=>(o.configurable=!0,o.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(t,e,o),o);function S(t,e){return(o,i,r)=>{let s=n=>n.renderRoot?.querySelector(t)??null;if(e){let{get:n,set:c}=typeof i=="object"?o:r??(()=>{let h=Symbol();return{get(){return this[h]},set(d){this[h]=d}}})();return oo(o,i,{get(){let h=n.call(this);return h===void 0&&(h=s(this),(h!==null||this.hasUpdated)&&c.call(this,h)),h}})}return oo(o,i,{get(){return s(this)}})}}function Ps(t){return(e,o)=>oo(e,o,{async get(){return await this.updateComplete,this.renderRoot?.querySelector(t)??null}})}var Yr=C`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden],
  :host([hidden]) {
    display: none !important;
  }
`,_h=/;\s+$/;function Th(t){return t.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}function Os(t){let{property:e,value:o,element:i}=t;if(o){let r=i.getAttribute("style")||"";r&&(r.match(_h)||(r+=";"),r+=" ");let s=`${e}: ${o}`;return r.includes(s)?void 0:`${r}${s};`}return null}var Gi,E=class extends eo{constructor(){super(),Ds(this,Gi,!1),this.initialReflectedProperties=new Map,this.didSSR=!!this.shadowRoot,this.customStates={set:(e,o)=>{if(this.internals?.states)try{o?this.internals.states.add(e):this.internals.states.delete(e)}catch(i){if(String(i).includes("must start with '--'"))console.error("Your browser implements an outdated version of CustomStateSet. Consider using a polyfill");else throw i}},has:e=>{if(!this.internals?.states)return!1;try{return this.internals.states.has(e)}catch{return!1}}};try{this.internals=this.attachInternals()}catch{console.error("Element internals are not supported in your browser. Consider using a polyfill")}this.customStates.set("wa-defined",!0);let t=this.constructor;for(let[e,o]of t.elementProperties)o.default==="inherit"&&o.initial!==void 0&&typeof e=="string"&&this.customStates.set(`initial-${e}-${o.initial}`,!0)}static get styles(){let t=Array.isArray(this.css)?this.css:this.css?[this.css]:[];return[Yr,...t]}connectedCallback(){super.connectedCallback(),this.didSSR||this.shadowRoot?.prepend(document.createComment(` Web Awesome: https://webawesome.com/docs/components/${this.localName.replace("wa-","")} `)),this.didSSR&&this.updateComplete.then(()=>{this.shadowRoot?.prepend(document.createComment(` Web Awesome: https://webawesome.com/docs/components/${this.localName.replace("wa-","")} `))})}attributeChangedCallback(t,e,o){Is(this,Gi)||(this.constructor.elementProperties.forEach((i,r)=>{i.reflect&&this[r]!=null&&this.initialReflectedProperties.set(r,this[r])}),Rs(this,Gi,!0)),super.attributeChangedCallback(t,e,o)}willUpdate(t){super.willUpdate(t),this.initialReflectedProperties.forEach((e,o)=>{t.has(o)&&this[o]==null&&(this[o]=e)})}firstUpdated(t){super.firstUpdated(t),this.didSSR&&this.shadowRoot?.querySelectorAll("slot").forEach(e=>{e.dispatchEvent(new Event("slotchange",{bubbles:!0,composed:!1,cancelable:!1}))})}update(t){try{super.update(t)}catch(e){if(this.didSSR&&!this.hasUpdated){let o=new Event("lit-hydration-error",{bubbles:!0,composed:!0,cancelable:!1});o.error=e,this.dispatchEvent(o)}throw e}}setStyle(t,e){if(!this.style){let o=Os({property:Th(t),value:e,element:this});o&&this.setAttribute("style",o);return}this.style[t]=e}setStyleProperty(t,e){if(!this.style){let o=Os({property:t,value:e,element:this});o&&this.setAttribute("style",o);return}this.style.setProperty(t,e)}relayNativeEvent(t,e){t.stopImmediatePropagation(),this.dispatchEvent(new t.constructor(t.type,{...t,...e}))}};Gi=new WeakMap;a([l()],E.prototype,"dir",2);a([l()],E.prototype,"lang",2);a([l({type:Boolean,reflect:!0,attribute:"did-ssr"})],E.prototype,"didSSR",2);var fe=class extends E{constructor(){super(...arguments),this.mode="multiple",this.iconPlacement="end",this.headingLevel="3",this.appearance="outlined"}getAllItems(){return this.defaultSlot.assignedElements({flatten:!0}).filter(t=>t.tagName.toLowerCase()==="wa-accordion-item")}getFocusableItems(){return this.getAllItems().filter(t=>!t.disabled)}ownsItem(t){return t.closest("wa-accordion")===this}initRovingTabIndex(){this.getFocusableItems().forEach((t,e)=>{t.isTabbable=e===0})}handleSlotChange(){if(this.didSSR){let t=[];if(this.getAllItems().forEach(e=>{e.didSSR&&!e.hasUpdated&&t.push(e.updateComplete)}),t.length>0){Promise.allSettled(t).then(()=>{this.handleSlotChange()});return}}this.syncIconPlacement(),this.syncHeadingLevel(),this.syncAppearance(),this.initRovingTabIndex()}handleFocusIn(t){let e=this.getFocusableItems(),i=t.composedPath().find(s=>s instanceof Element&&s.tagName.toLowerCase()==="wa-accordion-item");if(!i||!this.ownsItem(i))return;let r=e.find(s=>s===i);r&&e.forEach(s=>s.isTabbable=s===r)}handleKeyDown(t){let e=this.getFocusableItems();if(!e.length)return;let i=t.composedPath().find(n=>n instanceof Element&&n.tagName.toLowerCase()==="wa-accordion-item");if(!i||!this.ownsItem(i))return;let r=e.findIndex(n=>n.isTabbable),s=r;switch(t.key){case"ArrowDown":t.preventDefault(),s=(r+1)%e.length;break;case"ArrowUp":t.preventDefault(),s=(r-1+e.length)%e.length;break;case"Home":t.preventDefault(),s=0;break;case"End":t.preventDefault(),s=e.length-1;break;default:return}e.forEach((n,c)=>n.isTabbable=c===s),e[s].focus()}syncIconPlacement(){this.getAllItems().forEach(t=>t.iconPlacement=this.iconPlacement)}syncHeadingLevel(){this.getAllItems().forEach(t=>t.headingLevel=this.headingLevel)}syncAppearance(){this.getAllItems().forEach(t=>t.appearance=this.appearance)}async handleItemTrigger(t){let{item:e}=t.detail;if(this.ownsItem(e)&&(t.stopPropagation(),!e.disabled))if(e.expanded){if(this.mode==="single")return;let o=new ss({item:e});if(this.dispatchEvent(o),o.defaultPrevented)return;await e.collapse(),this.dispatchEvent(new ls({item:e}))}else{(this.mode==="single"||this.mode==="single-collapsible")&&this.getAllItems().filter(i=>i!==e&&i.expanded).forEach(i=>i.collapse());let o=new ns({item:e});if(this.dispatchEvent(o),o.defaultPrevented)return;await e.expand(),this.dispatchEvent(new cs({item:e}))}}expandAll(){this.mode==="single"||this.mode==="single-collapsible"||this.getAllItems().filter(t=>!t.disabled&&!t.expanded).forEach(t=>t.expand())}collapseAll(){this.getAllItems().filter(t=>t.expanded).forEach(t=>t.collapse())}render(){return p`
      <slot
        @slotchange=${this.handleSlotChange}
        @wa-accordion-item-trigger=${this.handleItemTrigger}
        @focusin=${this.handleFocusIn}
        @keydown=${this.handleKeyDown}
      ></slot>
    `}};fe.css=_s;a([S("slot")],fe.prototype,"defaultSlot",2);a([l({reflect:!0})],fe.prototype,"mode",2);a([l({attribute:"icon-placement",reflect:!0})],fe.prototype,"iconPlacement",2);a([l({attribute:"heading-level",reflect:!0})],fe.prototype,"headingLevel",2);a([l({reflect:!0})],fe.prototype,"appearance",2);a([y("iconPlacement",{waitUntilFirstUpdate:!0})],fe.prototype,"syncIconPlacement",1);a([y("headingLevel",{waitUntilFirstUpdate:!0})],fe.prototype,"syncHeadingLevel",1);a([y("appearance",{waitUntilFirstUpdate:!0})],fe.prototype,"syncAppearance",1);fe=a([k("wa-accordion")],fe);var Bs=class extends Event{constructor(){super("wa-accordion-item-collapsed",{bubbles:!1,cancelable:!1,composed:!1})}};var Fs=class extends Event{constructor(){super("wa-accordion-item-expanded",{bubbles:!1,cancelable:!1,composed:!1})}};var Vs=class extends Event{constructor(t){super("wa-accordion-item-trigger",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};function Ct(t,e){return new Promise(o=>{function i(r){r.target===t&&(t.removeEventListener(e,i),o())}t.addEventListener(e,i)})}async function ke(t,e,o){return t.animate(e,o).finished.catch(()=>{})}function G(t,e){return new Promise(o=>{let i=new AbortController,{signal:r}=i;if(t.classList.contains(e))return;t.classList.add(e);let s=!1,n=()=>{s||(s=!0,t.classList.remove(e),o(),i.abort())};t.addEventListener("animationend",n,{once:!0,signal:r}),t.addEventListener("animationcancel",n,{once:!0,signal:r}),requestAnimationFrame(()=>{!s&&t.getAnimations().length===0&&n()})})}function Ke(t){return t=t.toString().toLowerCase(),t.indexOf("ms")>-1?parseFloat(t)||0:t.indexOf("s")>-1?(parseFloat(t)||0)*1e3:parseFloat(t)||0}function $o(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}var Gr=new Set,Ho=new Map,Xe,Zr="ltr",Qr="en",qs=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(qs){let t=new MutationObserver(Ws);Zr=document.documentElement.dir||"ltr",Qr=document.documentElement.lang||navigator.language,t.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Uo(...t){t.map(e=>{let o=e.$code.toLowerCase();Ho.has(o)?Ho.set(o,Object.assign(Object.assign({},Ho.get(o)),e)):Ho.set(o,e),Xe||(Xe=e)}),Ws()}function Ws(){qs&&(Zr=document.documentElement.dir||"ltr",Qr=document.documentElement.lang||navigator.language),[...Gr.keys()].map(t=>{typeof t.requestUpdate=="function"&&t.requestUpdate()})}var Zi=class{constructor(e){this.host=e,this.host.addController(this)}hostConnected(){Gr.add(this.host)}hostDisconnected(){Gr.delete(this.host)}dir(){return`${this.host.dir||Zr}`.toLowerCase()}lang(){let e=`${this.host.lang||Qr}`.toLowerCase().replace(/_/g,"-");try{return new Intl.Locale(e),e}catch{return Xe?Xe.$code.toLowerCase():"en"}}getTranslationData(e){var o,i;let r;try{r=new Intl.Locale(e.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}let s=r.language.toLowerCase(),n=(i=(o=r.region)===null||o===void 0?void 0:o.toLowerCase())!==null&&i!==void 0?i:"",c=Ho.get(`${s}-${n}`),h=Ho.get(s);return{locale:r,language:s,region:n,primary:c,secondary:h}}exists(e,o){var i;let{primary:r,secondary:s}=this.getTranslationData((i=o.lang)!==null&&i!==void 0?i:this.lang());return o=Object.assign({includeFallback:!1},o),!!(r&&r[e]||s&&s[e]||o.includeFallback&&Xe&&Xe[e])}term(e,...o){let{primary:i,secondary:r}=this.getTranslationData(this.lang()),s;if(i&&i[e])s=i[e];else if(r&&r[e])s=r[e];else if(Xe&&Xe[e])s=Xe[e];else return console.error(`No translation found for: ${String(e)}`),String(e);return typeof s=="function"?s(...o):s}date(e,o){return e=new Date(e),new Intl.DateTimeFormat(this.lang(),o).format(e)}number(e,o){return e=Number(e),isNaN(e)?"":new Intl.NumberFormat(this.lang(),o).format(e)}relativeTime(e,o,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(e,o)}};var Ns={$code:"en",$name:"English",$dir:"ltr",am:"AM",autosizeColumn:"Autosize column",captions:"Captions",carousel:"Carousel",chooseDate:"Choose date",chooseDecade:"Choose decade",chooseMonth:"Choose month",chooseTime:"Choose time",chooseYear:"Choose year",clearEntry:"Clear entry",clearFilter:"Clear filter",clearSort:"Clear sort",close:"Close",closeCalendar:"Close calendar",closeTimeInput:"Close time picker",collapseRow:"Collapse row",columnMenu:"Column options",columnMovedToPosition:(t,e,o)=>`${t} moved to position ${e} of ${o}`,columns:"Columns",compactPageXOfY:(t,e)=>`${t} of ${e}`,copied:"Copied",copy:"Copy",createOption:t=>`Create "${t}"`,currentlyPlaying:"currently playing",currentValue:"Current value",date:"Date",datePickerKeyboardHelp:"Use arrow keys to change values; press Alt+Down Arrow to open the calendar.",day:"Day",dayPeriod:"AM/PM",decrement:"Decrement",deselectAllRows:"Deselect all rows",dropFileHere:"Drop file here or click to browse",dropFilesHere:"Drop files here or click to browse",empty:"Empty",endDate:"End date",enterFullscreen:"Enter fullscreen",error:"Error",exitFullscreen:"Exit fullscreen",expandRow:"Expand row",filterByColumn:t=>`Filter by ${t}`,filterFrom:"From",filterMax:"Max",filterMin:"Min",filterTo:"To",firstPage:"First page",goToSlide:(t,e)=>`Go to slide ${t} of ${e}`,hideColumn:"Hide column",hidePassword:"Hide password",hour:"Hour",incompleteDate:"Enter a valid date.",increment:"Increment",jumpBackwardX:t=>`Jump back ${t} pages`,jumpForwardX:t=>`Jump forward ${t} pages`,lastPage:"Last page",loading:"Loading",minute:"Minute",month:"Month",moreOptions:"More Options",mute:"Mute",nextDecade:"Next decade",nextMonth:"Next month",nextPage:"Next page",nextSlide:"Next slide",nextVideo:"Next Video",nextYear:"Next year",noData:"No data",noResults:"No matching results",now:"Now",numCharacters:t=>t===1?"1 character":`${t} characters`,numCharactersRemaining:t=>t===1?"1 character remaining":`${t} characters remaining`,numOptionsSelected:t=>t===0?"No options selected":t===1?"1 option selected":`${t} options selected`,numRowsCopied:t=>t===1?"1 row copied":`${t} rows copied`,numRowsSelected:t=>t===1?"1 row selected":`${t} rows selected`,pageXOfY:(t,e)=>`Page ${t} of ${e}`,pagination:"Pagination",pause:"Pause",pauseAnimation:"Pause animation",pictureInPicture:"Picture in picture",pinLeft:"Pin left",pinRight:"Pin right",play:"Play",playAnimation:"Play animation",playbackSpeed:"Playback speed",playlist:"Playlist",pm:"PM",previousDecade:"Previous decade",previousMonth:"Previous month",previousPage:"Previous page",previousSlide:"Previous slide",previousVideo:"Previous video",previousYear:"Previous year",progress:"Progress",rangeTooLong:t=>t===1?"Select a range no longer than 1 day":`Select a range no longer than ${t} days`,rangeTooShort:t=>t===1?"Select a range at least 1 day long":`Select a range at least ${t} days long`,readonly:"Read-only",remove:"Remove",resetColumns:"Reset columns",resize:"Resize",resizeColumn:"Resize column",rowsPerPage:"Rows per page",scrollableRegion:"Scrollable region",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",search:"Search",second:"Second",seek:"Seek",seekProgress:(t,e)=>`${t} of ${e}`,selectAColorFromTheScreen:"Select a color from the screen",selectAllRows:"Select all rows",selected:"Selected",selectedDateLabel:t=>`Selected: ${t}`,selectedRangeLabel:t=>`Selected range: ${t}`,selectGroup:"Select group",selectionCleared:"Selection cleared",selectRow:"Select row",showingNofMRows:(t,e)=>`Showing ${t} of ${e} rows`,showingXtoYofZ:(t,e,o)=>`${t}\u2013${e} of ${o}`,showPassword:"Show password",slideNum:t=>`Slide ${t}`,sortAscending:"Sort ascending",sortColumn:"Sort column",sortDescending:"Sort descending",startDate:"Start date",time:"Time",timeInputKeyboardHelp:"Use arrow keys to change values; press Alt+Down Arrow to open the time picker.",today:"Today",toggleColorFormat:"Toggle color format",unmute:"Unmute",unpin:"Unpin",unpinColumn:"Unpin column",videoPlayer:"Video player",volume:"Volume",year:"Year",zoomIn:"Zoom in",zoomOut:"Zoom out"};Uo(Ns);var Hs=Ns;var I=class extends Zi{lang(){return this.host.didSSR&&!this.host.hasUpdated?this.host.lang||"en":super.lang()}};Uo(Hs);var Us=C`
  @layer wa-component {
    :host {
      --spacing: var(--wa-space-m);
      --show-duration: var(--wa-transition-normal);
      --hide-duration: var(--wa-transition-normal);
      --easing: var(--wa-transition-easing);

      display: block;
    }

    :host(:not(:first-child)) {
      border-top: var(--wa-panel-border-width) var(--wa-panel-border-style) var(--wa-color-surface-border);
    }

    :host([appearance='filled']) {
      background-color: var(--wa-color-neutral-fill-quiet);
    }

    :host([appearance='filled']:not(:first-child)) {
      margin-block-start: var(--wa-panel-border-width);
      border-top: none;
    }

    [part~='heading'] {
      margin: 0;
      font: inherit;
    }

    [part~='button'] {
      display: flex;
      align-items: center;
      gap: var(--spacing);
      padding: var(--spacing);
      width: 100%;
      background: none;
      border: none;
      cursor: pointer;
      text-align: start;
      color: var(--wa-color-text-normal);
      font: inherit;
      font-weight: var(--wa-font-weight-semibold);

      &:focus {
        outline: none;
      }

      &:focus-visible {
        outline: var(--wa-focus-ring);
        /* Inset by the full ring width + offset so the parent's overflow:hidden doesn't clip it */
        outline-offset: calc(0px - var(--wa-focus-ring-width) - var(--wa-focus-ring-offset));
      }
    }

    /* Icon at end (default) */
    :host([icon-placement='end']) [part~='button'] {
      justify-content: space-between;
    }

    /* Icon at start */
    :host([icon-placement='start']) [part~='button'] {
      flex-direction: row-reverse;
      justify-content: flex-end;
    }

    :host([disabled]) {
      opacity: 0.5;
      cursor: not-allowed;
    }

    :host([disabled]) [part~='button'] {
      cursor: not-allowed;
      pointer-events: none;
    }

    :host(:first-child) [part~='button'] {
      border-top-left-radius: var(--wa-panel-border-radius);
      border-top-right-radius: var(--wa-panel-border-radius);
    }

    :host(:last-child:not([expanded])) [part~='button'] {
      border-bottom-left-radius: var(--wa-panel-border-radius);
      border-bottom-right-radius: var(--wa-panel-border-radius);
    }

    [part~='icon'] {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      color: var(--wa-color-text-quiet);
      transition: rotate var(--hide-duration) var(--easing);
    }

    :host([expanded]) [part~='icon'] {
      rotate: 90deg;
      transition-duration: var(--show-duration);
    }

    :host([expanded]:dir(rtl)) [part~='icon'] {
      rotate: -90deg;
    }

    .body {
      overflow: hidden;
      color: var(--wa-color-text-quiet);
    }

    :host([expanded]) .body:not(.animating) {
      overflow: visible;
    }

    .content {
      display: block;
      padding: 0 var(--spacing) var(--spacing);
    }
  }
`;var se={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},io=t=>(...e)=>({_$litDirective$:t,values:e}),Me=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,o,i){this._$Ct=e,this._$AM=o,this._$Ci=i}_$AS(e,o){return this.update(e,o)}update(e,o){return this.render(...o)}};var _=io(class extends Me{constructor(t){if(super(t),t.type!==se.ATTRIBUTE||t.name!=="class"||t.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter(e=>t[e]).join(" ")+" "}update(t,[e]){if(this.st===void 0){this.st=new Set,t.strings!==void 0&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(let i in e)e[i]&&!this.nt?.has(i)&&this.st.add(i);return this.render(e)}let o=t.element.classList;for(let i of this.st)i in e||(o.remove(i),this.st.delete(i));for(let i in e){let r=!!e[i];r===this.st.has(i)||this.nt?.has(i)||(r?(o.add(i),this.st.add(i)):(o.remove(i),this.st.delete(i)))}return Ot}});var Zt=class extends E{constructor(){super(...arguments),this.animationGeneration=0,this.localize=new I(this),this.isAnimating=!1,this.label="",this.expanded=!1,this.disabled=!1,this.headingLevel="3",this.isTabbable=!0,this.iconPlacement="end",this.appearance="outlined"}firstUpdated(){this.body.style.height=this.expanded?"auto":"0"}updated(){this.customStates.set("animating",this.isAnimating)}handleTriggerClick(){this.disabled||this.dispatchEvent(new Vs({item:this}))}handleTriggerKeyDown(t){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.handleTriggerClick())}async handleExpandedChange(){this.animationGeneration++;let t=this.animationGeneration;if(this.expanded){this.isAnimating=!0;let e=Ke(getComputedStyle(this.body).getPropertyValue("--show-duration")||"200ms"),o=getComputedStyle(this.body).getPropertyValue("--easing")||"ease";if(await ke(this.body,[{height:"0",opacity:"0"},{height:`${this.body.scrollHeight}px`,opacity:"1"}],{duration:e,easing:o}),this.animationGeneration!==t)return;this.body.style.height="auto",this.isAnimating=!1,this.dispatchEvent(new Fs)}else{this.isAnimating=!0;let e=Ke(getComputedStyle(this.body).getPropertyValue("--hide-duration")||"200ms"),o=getComputedStyle(this.body).getPropertyValue("--easing")||"ease";if(await ke(this.body,[{height:`${this.body.scrollHeight}px`,opacity:"1"},{height:"0",opacity:"0"}],{duration:e,easing:o}),this.animationGeneration!==t)return;this.body.style.height="0",this.isAnimating=!1,this.dispatchEvent(new Bs)}}async expand(){if(!(this.expanded||this.disabled))return this.expanded=!0,Ct(this,"wa-accordion-item-expanded")}async collapse(){if(!(!this.expanded||this.disabled))return this.expanded=!1,Ct(this,"wa-accordion-item-collapsed")}async toggle(){return this.expanded?this.collapse():this.expand()}focus(t){this.triggerButton?.focus(t)}renderHeadingWrapper(t){let e=parseInt(this.headingLevel,10);switch(e>=1&&e<=6?e:3){case 1:return p`<h1 part="heading">${t}</h1>`;case 2:return p`<h2 part="heading">${t}</h2>`;case 4:return p`<h4 part="heading">${t}</h4>`;case 5:return p`<h5 part="heading">${t}</h5>`;case 6:return p`<h6 part="heading">${t}</h6>`;default:return p`<h3 part="heading">${t}</h3>`}}render(){let t=this.hasUpdated?this.localize.dir()==="rtl":this.dir==="rtl",e=p`
      <button
        part="button"
        type="button"
        id="trigger"
        aria-expanded=${this.expanded?"true":"false"}
        aria-controls="panel"
        aria-disabled=${this.disabled?"true":"false"}
        tabindex=${this.disabled||!this.isTabbable?"-1":"0"}
        @click=${this.handleTriggerClick}
        @keydown=${this.handleTriggerKeyDown}
      >
        <slot name="label" part="label">${this.label}</slot>
        <span part="icon">
          <slot name="icon">
            <wa-icon library="system" variant="solid" name=${t?"chevron-left":"chevron-right"}></wa-icon>
          </slot>
        </span>
      </button>
    `;return p`
      <div part="base accordion-item">
        ${this.headingLevel==="none"?e:this.renderHeadingWrapper(e)}
        <div
          part="panel"
          id="panel"
          class=${_({body:!0,animating:this.isAnimating})}
          role="region"
          aria-labelledby="trigger"
        >
          <slot part="content" class="content"></slot>
        </div>
      </div>
    `}};Zt.css=Us;a([S(".body")],Zt.prototype,"body",2);a([S('[part~="button"]')],Zt.prototype,"triggerButton",2);a([A()],Zt.prototype,"isAnimating",2);a([l()],Zt.prototype,"label",2);a([l({type:Boolean,reflect:!0})],Zt.prototype,"expanded",2);a([l({type:Boolean,reflect:!0})],Zt.prototype,"disabled",2);a([l({attribute:"heading-level",reflect:!0})],Zt.prototype,"headingLevel",2);a([l({type:Boolean,attribute:!1})],Zt.prototype,"isTabbable",2);a([l({attribute:"icon-placement",reflect:!0})],Zt.prototype,"iconPlacement",2);a([l({reflect:!0})],Zt.prototype,"appearance",2);a([y("expanded",{waitUntilFirstUpdate:!0})],Zt.prototype,"handleExpandedChange",1);Zt=a([k("wa-accordion-item")],Zt);var Ie=class extends Event{constructor(){super("wa-error",{bubbles:!0,cancelable:!1,composed:!0})}};var Ao=class extends Event{constructor(){super("wa-load",{bubbles:!0,cancelable:!1,composed:!0})}};var js=C`
  :host {
    --primary-color: currentColor;
    --primary-opacity: 1;
    --secondary-color: currentColor;
    --secondary-opacity: 0.4;
    --rotate-angle: 0deg;

    box-sizing: content-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: -0.125em;
  }

  /* #region Canvas — the box the icon is centered within (mirrors Font Awesome's icon canvas). Orthogonal to font-size. */

  /* Fixed width (default): 1.25em × 1em (20 × 16px) */
  :host(:not([canvas])),
  :host([canvas='fixed']) {
    width: 1.25em;
    height: 1em;
    min-width: 1.25em; /* <-- this is what Safari respects for intrinsic */
    min-height: 1em;
  }

  /* Auto: hug the icon's width. \`auto-width\` is the deprecated alias for canvas="auto". */
  :host([canvas='auto']),
  :host([auto-width]:not([canvas])) {
    width: auto;
    height: 1em;
  }

  /* Square: 1.25em × 1.25em (20 × 20px) */
  :host([canvas='square']) {
    width: 1.25em;
    height: 1.25em;
    min-width: 1.25em;
    min-height: 1.25em;
  }

  /* Roomy: 1.5em × 1.5em (24 × 24px) */
  :host([canvas='roomy']) {
    width: 1.5em;
    height: 1.5em;
    min-width: 1.5em;
    min-height: 1.5em;
  }

  /* #endregion */

  svg {
    /* NOTE: Avoid setting fill here. A stylesheet rule beats SVG presentation attributes, breaking stroke-based
       libraries like Lucide (fill="none" stroke="currentColor") and attribute-based mutators (issue #1733). The default
       library applies fill="currentColor" in its mutator instead. */
    height: 1em;
    overflow: visible;
    width: auto;

    /* Duotone colors with path-specific opacity fallback */
    path[data-duotone-primary] {
      color: var(--primary-color);
      opacity: var(--path-opacity, var(--primary-opacity));
    }

    path[data-duotone-secondary] {
      color: var(--secondary-color);
      opacity: var(--path-opacity, var(--secondary-opacity));
    }
  }

  /* Rotation */
  :host([rotate]) {
    transform: rotate(var(--rotate-angle, 0deg));
  }

  /* Flipping */
  :host([flip='x']) {
    transform: scaleX(-1);
  }
  :host([flip='y']) {
    transform: scaleY(-1);
  }
  :host([flip='both']) {
    transform: scale(-1, -1);
  }

  /* Rotation and Flipping combined */
  :host([rotate][flip='x']) {
    transform: rotate(var(--rotate-angle, 0deg)) scaleX(-1);
  }
  :host([rotate][flip='y']) {
    transform: rotate(var(--rotate-angle, 0deg)) scaleY(-1);
  }
  :host([rotate][flip='both']) {
    transform: rotate(var(--rotate-angle, 0deg)) scale(-1, -1);
  }

  /* #region Animations — ported from Font Awesome 7.3 (--fa-* props mapped to wa-icon's --* names) */

  :host([animation='beat']) {
    animation-name: beat;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='bounce']) {
    animation-name: bounce;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
  }

  :host([animation='fade']) {
    animation-name: fade;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='beat-fade']) {
    animation-name: beat-fade;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='flip']) {
    animation-name: flip;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1.5s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='flip-360']) {
    animation-name: flip-360;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='shake']) {
    animation-name: shake;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.75s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
  }

  :host([animation='spin']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-pulse']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, steps(8));
  }

  /* spin-reverse is FA's reverse modifier expressed as a standalone value; reverse any spin via --animation-direction: reverse */
  :host([animation='spin-reverse']) {
    animation-name: spin;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, reverse);
    animation-duration: var(--animation-duration, 2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap']) {
    animation-name: spin-snap;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 3s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap-4']) {
    animation-name: spin-snap-4;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 2.4s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='spin-snap-8']) {
    animation-name: spin-snap-8;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 4s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='buzz']) {
    animation-name: buzz;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.6s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, linear);
  }

  :host([animation='wag']) {
    animation-name: wag;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.9s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
    transform-origin: bottom center;
  }

  :host([animation='float']) {
    animation-name: float;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 3s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-in-out);
    will-change: transform;
  }

  :host([animation='swing']) {
    animation-name: swing;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 1.2s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
    transform-origin: top center;
  }

  :host([animation='jello']) {
    animation-name: jello;
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, 0.9s);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    :host([animation='beat']),
    :host([animation='bounce']),
    :host([animation='fade']),
    :host([animation='beat-fade']),
    :host([animation='flip']),
    :host([animation='flip-360']),
    :host([animation='shake']),
    :host([animation='spin']),
    :host([animation='spin-pulse']),
    :host([animation='spin-reverse']),
    :host([animation='spin-snap']),
    :host([animation='spin-snap-4']),
    :host([animation='spin-snap-8']),
    :host([animation='buzz']),
    :host([animation='wag']),
    :host([animation='float']),
    :host([animation='swing']),
    :host([animation='jello']) {
      animation: none !important;
      transition: none !important;
    }
  }

  /* #endregion */

  /* #region Keyframes — ported verbatim from Font Awesome 7.3 */

  @keyframes beat {
    0% {
      transform: scale(1);
    }
    25% {
      transform: scale(calc(1.25 * var(--beat-scale, 1.25)));
    }
    45% {
      transform: scale(calc(1.22 * var(--beat-scale, 1.22)));
    }
    65% {
      transform: scale(calc(1.25 * var(--beat-scale, 1.25)));
    }
    90% {
      transform: scale(1);
    }
  }

  @keyframes bounce {
    0% {
      transform: scale(1, 1) translateY(0);
      /* No fallback by design (ported from FA 7.3): the first segment uses the user's --animation-timing or the CSS
         initial ease, while the explicit cubic-beziers on later stops drive the bounce physics. */
      animation-timing-function: var(--animation-timing);
    }
    14% {
      transform: scale(var(--bounce-start-scale-x, 1.06), var(--bounce-start-scale-y, 0.94))
        translateY(var(--bounce-anticipation, 3px));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    32% {
      transform: scale(var(--bounce-jump-scale-x, 0.94), var(--bounce-jump-scale-y, 1.12))
        translateY(calc(-1 * var(--bounce-height, 0.5em)));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    52% {
      transform: scale(1, 1) translateY(calc(-1 * var(--bounce-height, 0.5em) * 1.1));
      animation-timing-function: cubic-bezier(0.5, 0, 1, 0.5);
    }
    70% {
      transform: scale(var(--bounce-land-scale-x, 1.06), var(--bounce-land-scale-y, 0.92)) translateY(0);
      animation-timing-function: cubic-bezier(0.33, 0.33, 0.66, 1);
    }
    85% {
      transform: scale(0.98, 1.04) translateY(calc(-2px * var(--bounce-rebound, 1)));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: scale(1, 1) translateY(0);
    }
  }

  @keyframes fade {
    0% {
      opacity: 1;
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    40% {
      opacity: var(--fade-opacity, 0.4);
      transform: scale(0.98);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes beat-fade {
    0% {
      opacity: var(--beat-fade-opacity, 0.4);
      transform: scale(1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    25% {
      opacity: calc(var(--beat-fade-opacity, 0.4) + 0.4);
      transform: scale(var(--beat-fade-scale, 1.28));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    45% {
      opacity: 1;
      transform: scale(var(--beat-fade-scale, 1.25));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    65% {
      opacity: calc(var(--beat-fade-opacity, 0.4) + 0.4);
      transform: scale(var(--beat-fade-scale, 1.28));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    100% {
      opacity: var(--beat-fade-opacity, 0.4);
      transform: scale(1);
    }
  }

  @keyframes flip {
    0% {
      transform: perspective(2em) scale(1) rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    8% {
      transform: perspective(2em) scale(var(--flip-anticipation-scale, 0.95))
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    35% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.6));
      animation-timing-function: linear;
    }
    65% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.5));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    92% {
      transform: perspective(2em) scale(1)
        rotate3d(
          var(--flip-x, 0),
          var(--flip-y, 1),
          var(--flip-z, 0),
          calc(var(--flip-angle, -360deg) * var(--flip-overshoot, 1.04))
        );
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), var(--flip-angle, -360deg));
    }
  }

  @keyframes flip-360 {
    0% {
      transform: perspective(2em) scale(1) rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
    }
    8% {
      transform: perspective(2em) scale(var(--flip-anticipation-scale, 0.95))
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), 0deg);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    50% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), calc(var(--flip-angle, -360deg) * 0.6));
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    80% {
      transform: perspective(2em) scale(1)
        rotate3d(
          var(--flip-x, 0),
          var(--flip-y, 1),
          var(--flip-z, 0),
          calc(var(--flip-angle, -360deg) * var(--flip-overshoot, 1.04))
        );
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: perspective(2em) scale(1)
        rotate3d(var(--flip-x, 0), var(--flip-y, 1), var(--flip-z, 0), var(--flip-angle, -360deg));
    }
  }

  @keyframes shake {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    8% {
      transform: rotate(35deg) translateX(1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    20% {
      transform: rotate(-22deg) translateX(-1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    35% {
      transform: rotate(15deg) translateX(1px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    50% {
      transform: rotate(-9deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    65% {
      transform: rotate(5deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    78% {
      transform: rotate(-3deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    90% {
      transform: rotate(1deg);
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    12% {
      transform: rotate(60deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    16.67% {
      transform: rotate(60deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    28.67% {
      transform: rotate(120deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    33.33% {
      transform: rotate(120deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    45.33% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    62% {
      transform: rotate(240deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    66.67% {
      transform: rotate(240deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    78.67% {
      transform: rotate(300deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    83.33% {
      transform: rotate(300deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    95.33% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap-4 {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    15% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    25% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    40% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    65% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    75% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    90% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-snap-8 {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    9% {
      transform: rotate(45deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    12.5% {
      transform: rotate(45deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    21.5% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    25% {
      transform: rotate(90deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    34% {
      transform: rotate(135deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    37.5% {
      transform: rotate(135deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    46.5% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: rotate(180deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    59% {
      transform: rotate(225deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    62.5% {
      transform: rotate(225deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    71.5% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    75% {
      transform: rotate(270deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    84% {
      transform: rotate(315deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    87.5% {
      transform: rotate(315deg);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
    96.5% {
      transform: rotate(360deg);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes buzz {
    0% {
      transform: translateX(0) rotate(0deg);
      animation-timing-function: cubic-bezier(0.1, 0, 0.9, 1);
    }
    5% {
      transform: translateX(var(--buzz-distance, 4px)) rotate(0.5deg);
    }
    10% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px))) rotate(-0.5deg);
    }
    15% {
      transform: translateX(var(--buzz-distance, 4px)) rotate(0.3deg);
    }
    20% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px))) rotate(-0.3deg);
    }
    25% {
      transform: translateX(calc(var(--buzz-distance, 4px) * 0.7)) rotate(0.2deg);
    }
    30% {
      transform: translateX(calc(-1 * var(--buzz-distance, 4px) * 0.7)) rotate(-0.2deg);
    }
    35% {
      transform: translateX(calc(var(--buzz-distance, 4px) * 0.4)) rotate(0.1deg);
    }
    40% {
      transform: translateX(0) rotate(0deg);
    }
    100% {
      transform: translateX(0) rotate(0deg);
    }
  }

  @keyframes wag {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    12% {
      transform: rotate(var(--wag-angle, 12deg));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    24% {
      transform: rotate(2deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    36% {
      transform: rotate(calc(var(--wag-angle, 12deg) * 0.85));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    48% {
      transform: rotate(1deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
    }
    58% {
      transform: rotate(calc(var(--wag-angle, 12deg) * 0.6));
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    68% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes float {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    15% {
      transform: translateY(calc(-0.4 * var(--float-height, 6px))) translateX(var(--float-drift, 1px))
        rotate(var(--float-tilt, 1deg)) scale(1, 1);
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    35% {
      transform: translateY(calc(-1 * var(--float-height, 6px))) translateX(0) rotate(0deg)
        scale(var(--float-stretch-x, 0.98), var(--float-stretch-y, 1.03));
      animation-timing-function: cubic-bezier(0.5, 0, 0.5, 0);
    }
    50% {
      transform: translateY(calc(-0.92 * var(--float-height, 6px))) translateX(calc(-0.5 * var(--float-drift, 1px)))
        rotate(calc(-0.5 * var(--float-tilt, 1deg))) scale(0.995, 1.01);
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
    }
    70% {
      transform: translateY(calc(-0.3 * var(--float-height, 6px))) translateX(calc(-1 * var(--float-drift, 1px)))
        rotate(calc(-1 * var(--float-tilt, 1deg))) scale(1, 1);
      animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
    }
    90% {
      transform: translateY(calc(0.05 * var(--float-height, 6px))) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
      animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
    }
    100% {
      transform: translateY(0) translateX(0) rotate(0deg)
        scale(var(--float-squash-x, 1.02), var(--float-squash-y, 0.98));
    }
  }

  @keyframes swing {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    8% {
      transform: rotate(var(--swing-angle, 22deg));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    18% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.85));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    28% {
      transform: rotate(calc(var(--swing-angle, 22deg) * 0.65));
      animation-timing-function: cubic-bezier(0.35, 0, 0.65, 1);
    }
    38% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.45));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    48% {
      transform: rotate(calc(var(--swing-angle, 22deg) * 0.25));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    56% {
      transform: rotate(calc(-1 * var(--swing-angle, 22deg) * 0.1));
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    64% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes jello {
    0% {
      transform: scale(1, 1);
      animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
    }
    12% {
      transform: scale(var(--jello-scale-x, 1.15), calc(2 - var(--jello-scale-x, 1.15)));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    24% {
      transform: scale(calc(2 - var(--jello-scale-y, 1.12)), var(--jello-scale-y, 1.12));
      animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
    }
    36% {
      transform: scale(
        calc(1 + (var(--jello-scale-x, 1.15) - 1) * 0.5),
        calc(2 - (1 + (var(--jello-scale-x, 1.15) - 1) * 0.5))
      );
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    48% {
      transform: scale(
        calc(2 - (1 + (var(--jello-scale-y, 1.12) - 1) * 0.3)),
        calc(1 + (var(--jello-scale-y, 1.12) - 1) * 0.3)
      );
      animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    }
    58% {
      transform: scale(1.02, 0.98);
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    68% {
      transform: scale(1, 1);
    }
    100% {
      transform: scale(1, 1);
    }
  }

  /* #endregion */
`;var Jr="",Ks="",ta="";function ea(t){Jr=t}function oa(t=""){if(!Jr){let e=document.querySelector("[data-webawesome]");if(e?.hasAttribute("data-webawesome")){let o=new URL(e.getAttribute("data-webawesome")??"",window.location.href).pathname;ea(o)}else{let i=[...document.getElementsByTagName("script")].find(r=>r.src.endsWith("webawesome.js")||r.src.endsWith("webawesome.loader.js")||r.src.endsWith("webawesome.ssr-loader.js"));if(i){let r=String(i.getAttribute("src"));ea(r.split("/").slice(0,-1).join("/"))}}}return Jr.replace(/\/$/,"")+(t?`/${t.replace(/^\//,"")}`:"")}function Mh(t){Ks=t}function ia(){return Ks.replace(/\/$/,"")}function Xs(t){ta=t}function ra(){if(!ta){let t=document.querySelector("[data-fa-kit-code]");t&&Xs(t.getAttribute("data-fa-kit-code")||"")}return ta}var Ys="7.3.0";function Gs(t,e,o){let i="solid";return e==="chisel"&&(i="chisel-regular"),e==="etch"&&(i="etch-solid"),e==="graphite"&&(i="graphite-thin"),e==="jelly"&&(i="jelly-regular",o==="duo-regular"&&(i="jelly-duo-regular"),o==="fill-regular"&&(i="jelly-fill-regular")),e==="jelly-duo"&&(i="jelly-duo-regular"),e==="jelly-fill"&&(i="jelly-fill-regular"),e==="notdog"&&(o==="solid"&&(i="notdog-solid"),o==="duo-solid"&&(i="notdog-duo-solid")),e==="notdog-duo"&&(i="notdog-duo-solid"),e==="slab"&&((o==="solid"||o==="regular")&&(i="slab-regular"),o==="press-regular"&&(i="slab-press-regular")),e==="slab-press"&&(i="slab-press-regular"),e==="slab-duo"&&(i="slab-duo-regular"),e==="slab-press-duo"&&(i="slab-press-duo-regular"),e==="thumbprint"&&(i="thumbprint-light"),e==="utility"&&(i="utility-semibold"),e==="utility-duo"&&(i="utility-duo-semibold"),e==="utility-fill"&&(i="utility-fill-semibold"),e==="whiteboard"&&(i="whiteboard-semibold"),e==="mosaic"&&(i="mosaic-solid"),e==="pixel"&&(i="pixel-regular"),e==="vellum"&&(i="vellum-solid"),e==="classic"&&(o==="thin"&&(i="thin"),o==="light"&&(i="light"),o==="regular"&&(i="regular"),o==="solid"&&(i="solid")),e==="duotone"&&(o==="thin"&&(i="duotone-thin"),o==="light"&&(i="duotone-light"),o==="regular"&&(i="duotone-regular"),o==="solid"&&(i="duotone")),e==="sharp"&&(o==="thin"&&(i="sharp-thin"),o==="light"&&(i="sharp-light"),o==="regular"&&(i="sharp-regular"),o==="solid"&&(i="sharp-solid")),e==="sharp-duotone"&&(o==="thin"&&(i="sharp-duotone-thin"),o==="light"&&(i="sharp-duotone-light"),o==="regular"&&(i="sharp-duotone-regular"),o==="solid"&&(i="sharp-duotone-solid")),e==="brands"&&(i="brands"),i}function Ih(t,e,o){let i=Gs(t,e,o),r=ia();if(r)return`${r}/${i}/${t}.svg`;let s=ra();return s.length>0?`about:blank#wa-icon-cdn-disabled/releases/v${Ys}/svgs/${i}/${t}.svg?token=${encodeURIComponent(s)}`:`about:blank#wa-icon-cdn-disabled/releases/v${Ys}/svgs/${i}/${t}.svg`}var Dh={name:"default",resolver:(t,e="classic",o="solid")=>Ih(t,e,o),mutator:(t,e)=>{if(t.hasAttribute("fill")||t.setAttribute("fill","currentColor"),e?.family&&!t.hasAttribute("data-duotone-initialized")){let{family:o,variant:i}=e;if(o==="duotone"||o==="sharp-duotone"||o==="notdog-duo"||o==="notdog"&&i==="duo-solid"||o==="jelly-duo"||o==="jelly"&&i==="duo-regular"||o==="utility-duo"||o==="slab-duo"||o==="slab-press-duo"||o==="thumbprint"){let r=[...t.querySelectorAll("path")],s=r.find(c=>!c.hasAttribute("opacity")),n=r.find(c=>c.hasAttribute("opacity"));if(!s||!n)return;if(s.setAttribute("data-duotone-primary",""),n.setAttribute("data-duotone-secondary",""),e.swapOpacity&&s&&n){let c=n.getAttribute("opacity")||"0.4";s.style.setProperty("--path-opacity",c),n.style.setProperty("--path-opacity","1")}t.setAttribute("data-duotone-initialized","")}}}},Zs=Dh;function Rh(t){return`data:image/svg+xml,${encodeURIComponent(t)}`}var aa={solid:{backward:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M236.3 107.1C247.9 96 265 92.9 279.7 99.2C294.4 105.5 304 120 304 136L304 272.3L476.3 107.2C487.9 96 505 92.9 519.7 99.2C534.4 105.5 544 120 544 136L544 504C544 520 534.4 534.5 519.7 540.8C505 547.1 487.9 544 476.3 532.9L304 367.7L304 504C304 520 294.4 534.5 279.7 540.8C265 547.1 247.9 544 236.3 532.9L44.3 348.9C36.5 341.3 32 330.9 32 320C32 309.1 36.5 298.7 44.3 291.1L236.3 107.1z"/></svg>',"backward-step":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M491 100.8C478.1 93.8 462.3 94.5 450 102.6L192 272.1L192 128C192 110.3 177.7 96 160 96C142.3 96 128 110.3 128 128L128 512C128 529.7 142.3 544 160 544C177.7 544 192 529.7 192 512L192 367.9L450 537.5C462.3 545.6 478 546.3 491 539.3C504 532.3 512 518.8 512 504.1L512 136.1C512 121.4 503.9 107.9 491 100.9z"/></svg>',"angles-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M77.3 256 214.7 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256zm192 0L406.7 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L269.3 256z"/></svg>',"angles-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M434.7 256 297.3 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L434.7 256zm-192 0L105.3 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256z"/></svg>',check:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"/></svg>',"chevron-down":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M201.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 338.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>',"chevron-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>',"chevron-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>',circle:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>',"closed-captioning":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M64 192C64 156.7 92.7 128 128 128L512 128C547.3 128 576 156.7 576 192L576 448C576 483.3 547.3 512 512 512L128 512C92.7 512 64 483.3 64 448L64 192zM216 272L248 272C252.4 272 256 275.6 256 280C256 293.3 266.7 304 280 304C293.3 304 304 293.3 304 280C304 249.1 278.9 224 248 224L216 224C185.1 224 160 249.1 160 280L160 360C160 390.9 185.1 416 216 416L248 416C278.9 416 304 390.9 304 360C304 346.7 293.3 336 280 336C266.7 336 256 346.7 256 360C256 364.4 252.4 368 248 368L216 368C211.6 368 208 364.4 208 360L208 280C208 275.6 211.6 272 216 272zM384 280C384 275.6 387.6 272 392 272L424 272C428.4 272 432 275.6 432 280C432 293.3 442.7 304 456 304C469.3 304 480 293.3 480 280C480 249.1 454.9 224 424 224L392 224C361.1 224 336 249.1 336 280L336 360C336 390.9 361.1 416 392 416L424 416C454.9 416 480 390.9 480 360C480 346.7 469.3 336 456 336C442.7 336 432 346.7 432 360C432 364.4 428.4 368 424 368L392 368C387.6 368 384 364.4 384 360L384 280z"/></svg>',"closed-captioning-slash":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M39 39.1C48.4 29.7 63.6 29.7 72.9 39.1L161.8 128L512 128C547.3 128 576 156.7 576 192L576 448C576 473.5 561.1 495.4 539.6 505.8L601 567.1C610.4 576.5 610.4 591.7 601 601C591.6 610.3 576.4 610.4 567.1 601L39 73.1C29.7 63.7 29.7 48.5 39 39.1zM384 350.1L384 279.9C384 275.5 387.6 271.9 392 271.9L424 271.9C428.4 271.9 432 275.5 432 279.9C432 293.2 442.7 303.9 456 303.9C469.3 303.9 480 293.2 480 279.9C480 249 454.9 223.9 424 223.9L392 223.9C361.1 223.9 336 249 336 279.9L336 302.1L384 350.1zM445.5 411.6C465.7 403.2 480 383.2 480 359.9C480 346.6 469.3 335.9 456 335.9C442.7 335.9 432 346.6 432 359.9C432 364.3 428.4 367.9 424 367.9L401.8 367.9L445.5 411.6zM162.3 264.1C160.8 269.1 160 274.5 160 280L160 360C160 390.9 185.1 416 216 416L248 416C266.1 416 282.1 407.5 292.4 394.2L410.2 512L128 512C92.7 512 64 483.3 64 448L64 192C64 184.2 65.4 176.7 68 169.8L162.3 264.1zM256.1 357.9C256 358.6 256 359.3 256 360C256 364.4 252.4 368 248 368L216 368C211.6 368 208 364.4 208 360L208 309.8L256.1 357.9z"/></svg>',compress:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M160 64c0-17.7-14.3-32-32-32S96 46.3 96 64l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 320c-17.7 0-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0z"/></svg>',ellipsis:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M96 320C96 289.1 121.1 264 152 264C182.9 264 208 289.1 208 320C208 350.9 182.9 376 152 376C121.1 376 96 350.9 96 320zM264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320zM488 264C518.9 264 544 289.1 544 320C544 350.9 518.9 376 488 376C457.1 376 432 350.9 432 320C432 289.1 457.1 264 488 264z"/></svg>',"ellipsis-vertical":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M320 208C289.1 208 264 182.9 264 152C264 121.1 289.1 96 320 96C350.9 96 376 121.1 376 152C376 182.9 350.9 208 320 208zM320 432C350.9 432 376 457.1 376 488C376 518.9 350.9 544 320 544C289.1 544 264 518.9 264 488C264 457.1 289.1 432 320 432zM376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320z"/></svg>',expand:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 96C110.3 96 96 110.3 96 128L96 224C96 241.7 110.3 256 128 256C145.7 256 160 241.7 160 224L160 160L224 160C241.7 160 256 145.7 256 128C256 110.3 241.7 96 224 96L128 96zM160 416C160 398.3 145.7 384 128 384C110.3 384 96 398.3 96 416L96 512C96 529.7 110.3 544 128 544L224 544C241.7 544 256 529.7 256 512C256 494.3 241.7 480 224 480L160 480L160 416zM416 96C398.3 96 384 110.3 384 128C384 145.7 398.3 160 416 160L480 160L480 224C480 241.7 494.3 256 512 256C529.7 256 544 241.7 544 224L544 128C544 110.3 529.7 96 512 96L416 96zM544 416C544 398.3 529.7 384 512 384C494.3 384 480 398.3 480 416L480 480L416 480C398.3 480 384 494.3 384 512C384 529.7 398.3 544 416 544L512 544C529.7 544 544 529.7 544 512L544 416z"/></svg>',eyedropper:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M341.6 29.2l-101.6 101.6-9.4-9.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-9.4-9.4 101.6-101.6c39-39 39-102.2 0-141.1s-102.2-39-141.1 0zM55.4 323.3c-15 15-23.4 35.4-23.4 56.6l0 42.4-26.6 39.9c-8.5 12.7-6.8 29.6 4 40.4s27.7 12.5 40.4 4l39.9-26.6 42.4 0c21.2 0 41.6-8.4 56.6-23.4l109.4-109.4-45.3-45.3-109.4 109.4c-3 3-7.1 4.7-11.3 4.7l-36.1 0 0-36.1c0-4.2 1.7-8.3 4.7-11.3l109.4-109.4-45.3-45.3-109.4 109.4z"/></svg>',forward:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M403.7 107.1C392.1 96 375 92.9 360.3 99.2C345.6 105.5 336 120 336 136L336 272.3L163.7 107.2C152.1 96 135 92.9 120.3 99.2C105.6 105.5 96 120 96 136L96 504C96 520 105.6 534.5 120.3 540.8C135 547.1 152.1 544 163.7 532.9L336 367.7L336 504C336 520 345.6 534.5 360.3 540.8C375 547.1 392.1 544 403.7 532.9L595.7 348.9C603.6 341.4 608 330.9 608 320C608 309.1 603.5 298.7 595.7 291.1L403.7 107.1z"/></svg>',file:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 234.5C512 217.5 505.3 201.2 493.3 189.2L386.7 82.7C374.7 70.7 358.5 64 341.5 64L192 64zM453.5 240L360 240C346.7 240 336 229.3 336 216L336 122.5L453.5 240z"/></svg>',"file-audio":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM389.8 307.7C380.7 301.4 368.3 303.6 362 312.7C355.7 321.8 357.9 334.2 367 340.5C390.9 357.2 406.4 384.8 406.4 416C406.4 447.2 390.8 474.9 367 491.5C357.9 497.8 355.7 510.3 362 519.3C368.3 528.3 380.8 530.6 389.8 524.3C423.9 500.5 446.4 460.8 446.4 416C446.4 371.2 424 331.5 389.8 307.7zM208 376C199.2 376 192 383.2 192 392L192 440C192 448.8 199.2 456 208 456L232 456L259.2 490C262.2 493.8 266.8 496 271.7 496L272 496C280.8 496 288 488.8 288 480L288 352C288 343.2 280.8 336 272 336L271.7 336C266.8 336 262.2 338.2 259.2 342L232 376L208 376zM336 448.2C336 458.9 346.5 466.4 354.9 459.8C367.8 449.5 376 433.7 376 416C376 398.3 367.8 382.5 354.9 372.2C346.5 365.5 336 373.1 336 383.8L336 448.3z"/></svg>',"file-code":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM282.2 359.6C290.8 349.5 289.7 334.4 279.6 325.8C269.5 317.2 254.4 318.3 245.8 328.4L197.8 384.4C190.1 393.4 190.1 406.6 197.8 415.6L245.8 471.6C254.4 481.7 269.6 482.8 279.6 474.2C289.6 465.6 290.8 450.4 282.2 440.4L247.6 400L282.2 359.6zM394.2 328.4C385.6 318.3 370.4 317.2 360.4 325.8C350.4 334.4 349.2 349.6 357.8 359.6L392.4 400L357.8 440.4C349.2 450.5 350.3 465.6 360.4 474.2C370.5 482.8 385.6 481.7 394.2 471.6L442.2 415.6C449.9 406.6 449.9 393.4 442.2 384.4L394.2 328.4z"/></svg>',"file-excel":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM292 330.7C284.6 319.7 269.7 316.7 258.7 324C247.7 331.3 244.7 346.3 252 357.3L291.2 416L252 474.7C244.6 485.7 247.6 500.6 258.7 508C269.8 515.4 284.6 512.4 292 501.3L320 459.3L348 501.3C355.4 512.3 370.3 515.3 381.3 508C392.3 500.7 395.3 485.7 388 474.7L348.8 416L388 357.3C395.4 346.3 392.4 331.4 381.3 324C370.2 316.6 355.4 319.6 348 330.7L320 372.7L292 330.7z"/></svg>',"file-image":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM256 320C256 302.3 241.7 288 224 288C206.3 288 192 302.3 192 320C192 337.7 206.3 352 224 352C241.7 352 256 337.7 256 320zM220.6 512L419.4 512C435.2 512 448 499.2 448 483.4C448 476.1 445.2 469 440.1 463.7L343.3 361.9C337.3 355.6 328.9 352 320.1 352L319.8 352C311 352 302.7 355.6 296.6 361.9L199.9 463.7C194.8 469 192 476.1 192 483.4C192 499.2 204.8 512 220.6 512z"/></svg>',"file-pdf":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 64C92.7 64 64 92.7 64 128L64 512C64 547.3 92.7 576 128 576L208 576L208 464C208 428.7 236.7 400 272 400L448 400L448 234.5C448 217.5 441.3 201.2 429.3 189.2L322.7 82.7C310.7 70.7 294.5 64 277.5 64L128 64zM389.5 240L296 240C282.7 240 272 229.3 272 216L272 122.5L389.5 240zM272 444C261 444 252 453 252 464L252 592C252 603 261 612 272 612C283 612 292 603 292 592L292 564L304 564C337.1 564 364 537.1 364 504C364 470.9 337.1 444 304 444L272 444zM304 524L292 524L292 484L304 484C315 484 324 493 324 504C324 515 315 524 304 524zM400 444C389 444 380 453 380 464L380 592C380 603 389 612 400 612L432 612C460.7 612 484 588.7 484 560L484 496C484 467.3 460.7 444 432 444L400 444zM420 572L420 484L432 484C438.6 484 444 489.4 444 496L444 560C444 566.6 438.6 572 432 572L420 572zM508 464L508 592C508 603 517 612 528 612C539 612 548 603 548 592L548 548L576 548C587 548 596 539 596 528C596 517 587 508 576 508L548 508L548 484L576 484C587 484 596 475 596 464C596 453 587 444 576 444L528 444C517 444 508 453 508 464z"/></svg>',"file-powerpoint":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM280 320C266.7 320 256 330.7 256 344L256 488C256 501.3 266.7 512 280 512C293.3 512 304 501.3 304 488L304 464L328 464C367.8 464 400 431.8 400 392C400 352.2 367.8 320 328 320L280 320zM328 416L304 416L304 368L328 368C341.3 368 352 378.7 352 392C352 405.3 341.3 416 328 416z"/></svg>',"file-video":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM208 368L208 464C208 481.7 222.3 496 240 496L336 496C353.7 496 368 481.7 368 464L368 440L403 475C406.2 478.2 410.5 480 415 480C424.4 480 432 472.4 432 463L432 368.9C432 359.5 424.4 351.9 415 351.9C410.5 351.9 406.2 353.7 403 356.9L368 391.9L368 367.9C368 350.2 353.7 335.9 336 335.9L240 335.9C222.3 335.9 208 350.2 208 367.9z"/></svg>',"file-word":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM263.4 338.8C260.5 325.9 247.7 317.7 234.8 320.6C221.9 323.5 213.7 336.3 216.6 349.2L248.6 493.2C250.9 503.7 260 511.4 270.8 512C281.6 512.6 291.4 505.9 294.8 495.6L320 419.9L345.2 495.6C348.6 505.8 358.4 512.5 369.2 512C380 511.5 389.1 503.8 391.4 493.2L423.4 349.2C426.3 336.3 418.1 323.4 405.2 320.6C392.3 317.8 379.4 325.9 376.6 338.8L363.4 398.2L342.8 336.4C339.5 326.6 330.4 320 320 320C309.6 320 300.5 326.6 297.2 336.4L276.6 398.2L263.4 338.8z"/></svg>',"file-zipper":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 136C192 149.3 202.7 160 216 160L264 160C277.3 160 288 149.3 288 136C288 122.7 277.3 112 264 112L216 112C202.7 112 192 122.7 192 136zM192 232C192 245.3 202.7 256 216 256L264 256C277.3 256 288 245.3 288 232C288 218.7 277.3 208 264 208L216 208C202.7 208 192 218.7 192 232zM256 304L224 304C206.3 304 192 318.3 192 336L192 384C192 410.5 213.5 432 240 432C266.5 432 288 410.5 288 384L288 336C288 318.3 273.7 304 256 304zM240 368C248.8 368 256 375.2 256 384C256 392.8 248.8 400 240 400C231.2 400 224 392.8 224 384C224 375.2 231.2 368 240 368z"/></svg>',"forward-step":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M21 36.8c12.9-7 28.7-6.3 41 1.8L320 208.1 320 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 384c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-144.1-258 169.6c-12.3 8.1-28 8.8-41 1.8S0 454.7 0 440L0 72C0 57.3 8.1 43.8 21 36.8z"/></svg>',gauge:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm320 96c0-26.9-16.5-49.9-40-59.3L280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 172.7c-23.5 9.5-40 32.5-40 59.3 0 35.3 28.7 64 64 64s64-28.7 64-64zM144 176a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm-16 80a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM400 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>',gear:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z"/></svg>',"grip-vertical":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M128 40c0-22.1-17.9-40-40-40L40 0C17.9 0 0 17.9 0 40L0 88c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zm0 192c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zM0 424l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40zM320 40c0-22.1-17.9-40-40-40L232 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48zM192 232l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40zM320 424c0-22.1-17.9-40-40-40l-48 0c-22.1 0-40 17.9-40 40l0 48c0 22.1 17.9 40 40 40l48 0c22.1 0 40-17.9 40-40l0-48z"/></svg>',indeterminate:'<svg part="indeterminate-icon" class="icon" viewBox="0 0 16 16"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round"><g stroke="currentColor" stroke-width="2"><g transform="translate(2.285714 6.857143)"><path d="M10.2857143,1.14285714 L1.14285714,1.14285714"/></g></g></g></svg>',minus:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32z"/></svg>',pause:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M48 32C21.5 32 0 53.5 0 80L0 432c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48L48 32zm224 0c-26.5 0-48 21.5-48 48l0 352c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48l-64 0z"/></svg>',"picture-in-picture":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M448 32c35.3 0 64 28.7 64 64l0 112-64 0 0-112-384 0 0 320 144 0 0 64-144 0-6.5-.3c-30.1-3.1-54.1-27-57.1-57.1L0 416 0 96C0 62.9 25.2 35.6 57.5 32.3L64 32 448 32zm16 224c26.5 0 48 21.5 48 48l0 128c0 26.5-21.5 48-48 48l-160 0c-26.5 0-48-21.5-48-48l0-128c0-26.5 21.5-48 48-48l160 0z"/></svg>',play:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z"/></svg>',"play-circle":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zM188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9l0 176c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z"/></svg>',plus:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/></svg>',star:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M309.5-18.9c-4.1-8-12.4-13.1-21.4-13.1s-17.3 5.1-21.4 13.1L193.1 125.3 33.2 150.7c-8.9 1.4-16.3 7.7-19.1 16.3s-.5 18 5.8 24.4l114.4 114.5-25.2 159.9c-1.4 8.9 2.3 17.9 9.6 23.2s16.9 6.1 25 2L288.1 417.6 432.4 491c8 4.1 17.7 3.3 25-2s11-14.2 9.6-23.2L441.7 305.9 556.1 191.4c6.4-6.4 8.6-15.8 5.8-24.4s-10.1-14.9-19.1-16.3L383 125.3 309.5-18.9z"/></svg>',upload:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free 7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M352 173.3L352 384C352 401.7 337.7 416 320 416C302.3 416 288 401.7 288 384L288 173.3L246.6 214.7C234.1 227.2 213.8 227.2 201.3 214.7C188.8 202.2 188.8 181.9 201.3 169.4L297.3 73.4C309.8 60.9 330.1 60.9 342.6 73.4L438.6 169.4C451.1 181.9 451.1 202.2 438.6 214.7C426.1 227.2 405.8 227.2 393.3 214.7L352 173.3zM320 464C364.2 464 400 428.2 400 384L480 384C515.3 384 544 412.7 544 448L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 448C96 412.7 124.7 384 160 384L240 384C240 428.2 275.8 464 320 464zM464 488C477.3 488 488 477.3 488 464C488 450.7 477.3 440 464 440C450.7 440 440 450.7 440 464C440 477.3 450.7 488 464 488z"/></svg>',user:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M224 248a120 120 0 1 0 0-240 120 120 0 1 0 0 240zm-29.7 56C95.8 304 16 383.8 16 482.3 16 498.7 29.3 512 45.7 512l356.6 0c16.4 0 29.7-13.3 29.7-29.7 0-98.5-79.8-178.3-178.3-178.3l-59.4 0z"/></svg>',volume:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/></svg>',"volume-low":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM380.6 181.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/></svg>',"volume-xmark":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM367 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z"/></svg>',xmark:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/></svg>'},regular:{calendar:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M216 64C229.3 64 240 74.7 240 88L240 128L400 128L400 88C400 74.7 410.7 64 424 64C437.3 64 448 74.7 448 88L448 128L480 128C515.3 128 544 156.7 544 192L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 192C96 156.7 124.7 128 160 128L192 128L192 88C192 74.7 202.7 64 216 64zM216 176L160 176C151.2 176 144 183.2 144 192L144 240L496 240L496 192C496 183.2 488.8 176 480 176L216 176zM144 288L144 480C144 488.8 151.2 496 160 496L480 496C488.8 496 496 488.8 496 480L496 288L144 288z"/></svg>',"circle-question":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M464 256a208 208 0 1 0 -416 0 208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm256-80c-17.7 0-32 14.3-32 32 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-44.2 35.8-80 80-80s80 35.8 80 80c0 47.2-36 67.2-56 74.5l0 3.8c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-8.1c0-20.5 14.8-35.2 30.1-40.2 6.4-2.1 13.2-5.5 18.2-10.3 4.3-4.2 7.7-10 7.7-19.6 0-17.7-14.3-32-32-32zM224 368a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',"circle-xmark":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM167 167c-9.4 9.4-9.4 24.6 0 33.9l55 55-55 55c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l55-55 55 55c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-55-55 55-55c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-55 55-55-55c-9.4-9.4-24.6-9.4-33.9 0z"/></svg>',clock:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>',copy:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l133.5 0c4.2 0 8.3 1.7 11.3 4.7l58.5 58.5c3 3 4.7 7.1 4.7 11.3L400 320c0 8.8-7.2 16-16 16zM192 384l192 0c35.3 0 64-28.7 64-64l0-197.5c0-17-6.7-33.3-18.7-45.3L370.7 18.7C358.7 6.7 342.5 0 325.5 0L192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-48 0 0 16c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l16 0 0-48-16 0z"/></svg>',eye:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M288 80C222.8 80 169.2 109.6 128.1 147.7 89.6 183.5 63 226 49.4 256 63 286 89.6 328.5 128.1 364.3 169.2 402.4 222.8 432 288 432s118.8-29.6 159.9-67.7C486.4 328.5 513 286 526.6 256 513 226 486.4 183.5 447.9 147.7 406.8 109.6 353.2 80 288 80zM95.4 112.6C142.5 68.8 207.2 32 288 32s145.5 36.8 192.6 80.6c46.8 43.5 78.1 95.4 93 131.1 3.3 7.9 3.3 16.7 0 24.6-14.9 35.7-46.2 87.7-93 131.1-47.1 43.7-111.8 80.6-192.6 80.6S142.5 443.2 95.4 399.4c-46.8-43.5-78.1-95.4-93-131.1-3.3-7.9-3.3-16.7 0-24.6 14.9-35.7 46.2-87.7 93-131.1zM288 336c44.2 0 80-35.8 80-80 0-29.6-16.1-55.5-40-69.3-1.4 59.7-49.6 107.9-109.3 109.3 13.8 23.9 39.7 40 69.3 40zm-79.6-88.4c2.5 .3 5 .4 7.6 .4 35.3 0 64-28.7 64-64 0-2.6-.2-5.1-.4-7.6-37.4 3.9-67.2 33.7-71.1 71.1zm45.6-115c10.8-3 22.2-4.5 33.9-4.5 8.8 0 17.5 .9 25.8 2.6 .3 .1 .5 .1 .8 .2 57.9 12.2 101.4 63.7 101.4 125.2 0 70.7-57.3 128-128 128-61.6 0-113-43.5-125.2-101.4-1.8-8.6-2.8-17.5-2.8-26.6 0-11 1.4-21.8 4-32 .2-.7 .3-1.3 .5-1.9 11.9-43.4 46.1-77.6 89.5-89.5z"/></svg>',"eye-slash":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M41-24.9c-9.4-9.4-24.6-9.4-33.9 0S-2.3-.3 7 9.1l528 528c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-96.4-96.4c2.7-2.4 5.4-4.8 8-7.2 46.8-43.5 78.1-95.4 93-131.1 3.3-7.9 3.3-16.7 0-24.6-14.9-35.7-46.2-87.7-93-131.1-47.1-43.7-111.8-80.6-192.6-80.6-56.8 0-105.6 18.2-146 44.2L41-24.9zM176.9 111.1c32.1-18.9 69.2-31.1 111.1-31.1 65.2 0 118.8 29.6 159.9 67.7 38.5 35.7 65.1 78.3 78.6 108.3-13.6 30-40.2 72.5-78.6 108.3-3.1 2.8-6.2 5.6-9.4 8.4L393.8 328c14-20.5 22.2-45.3 22.2-72 0-70.7-57.3-128-128-128-26.7 0-51.5 8.2-72 22.2l-39.1-39.1zm182 182l-108-108c11.1-5.8 23.7-9.1 37.1-9.1 44.2 0 80 35.8 80 80 0 13.4-3.3 26-9.1 37.1zM103.4 173.2l-34-34c-32.6 36.8-55 75.8-66.9 104.5-3.3 7.9-3.3 16.7 0 24.6 14.9 35.7 46.2 87.7 93 131.1 47.1 43.7 111.8 80.6 192.6 80.6 37.3 0 71.2-7.9 101.5-20.6L352.2 422c-20 6.4-41.4 10-64.2 10-65.2 0-118.8-29.6-159.9-67.7-38.5-35.7-65.1-78.3-78.6-108.3 10.4-23.1 28.6-53.6 54-82.8z"/></svg>',star:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Free 7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc. --><path fill="currentColor" d="M288.1-32c9 0 17.3 5.1 21.4 13.1L383 125.3 542.9 150.7c8.9 1.4 16.3 7.7 19.1 16.3s.5 18-5.8 24.4L441.7 305.9 467 465.8c1.4 8.9-2.3 17.9-9.6 23.2s-17 6.1-25 2L288.1 417.6 143.8 491c-8 4.1-17.7 3.3-25-2s-11-14.2-9.6-23.2L134.4 305.9 20 191.4c-6.4-6.4-8.6-15.8-5.8-24.4s10.1-14.9 19.1-16.3l159.9-25.4 73.6-144.2c4.1-8 12.4-13.1 21.4-13.1zm0 76.8L230.3 158c-3.5 6.8-10 11.6-17.6 12.8l-125.5 20 89.8 89.9c5.4 5.4 7.9 13.1 6.7 20.7l-19.8 125.5 113.3-57.6c6.8-3.5 14.9-3.5 21.8 0l113.3 57.6-19.8-125.5c-1.2-7.6 1.3-15.3 6.7-20.7l89.8-89.9-125.5-20c-7.6-1.2-14.1-6-17.6-12.8L288.1 44.8z"/></svg>'}},Ph={name:"system",resolver:(t,e="classic",o="solid")=>{let r=aa[o][t]??aa.regular[t]??aa.regular["circle-question"];return r?Rh(r):""}},Qs=Ph;var Js="classic",Qi=[Zs,Qs],Ji=new Set;function tn(t){Ji.add(t)}function en(t){Ji.delete(t)}function tr(t){return Qi.find(e=>e.name===t)}function sa(t,e){on(t),Qi.push({name:t,resolver:e.resolver,mutator:e.mutator,spriteSheet:e.spriteSheet}),Ji.forEach(o=>{o.library===t&&o.setIcon()})}function on(t){Qi=Qi.filter(e=>e.name!==t)}function Oh(t){Js=t,Ji.forEach(e=>e.setIcon())}function na(){return Js}var{I:t2}=$s;var rn=(t,e)=>e===void 0?t?._$litType$!==void 0:t?._$litType$===e;var an=t=>t.strings===void 0;var Bh={},sn=(t,e=Bh)=>t._$AH=e;var mi=Symbol(),er=Symbol(),la,ca=new Map,Tt=class extends E{constructor(){super(...arguments),this.svg=null,this.autoWidth=!1,this.swapOpacity=!1,this.label="",this.library="default",this.rotate=0,this.resolveIcon=async(t,e)=>{let o;if(e?.spriteSheet){this.hasUpdated||await this.updateComplete,this.svg=p`<svg part="svg">
        <use part="use" href="${t}"></use>
      </svg>`,await this.updateComplete;let i=this.shadowRoot.querySelector("[part='svg']");return typeof e.mutator=="function"&&e.mutator(i,this),this.svg}try{if(o=await fetch(t,{mode:"cors"}),!o.ok)return o.status===410?mi:er}catch{return er}try{let i=document.createElement("div");i.innerHTML=await o.text();let r=i.firstElementChild;if(r?.tagName?.toLowerCase()!=="svg")return mi;la||(la=new DOMParser);let n=la.parseFromString(r.outerHTML,"text/html").body.querySelector("svg");return n?(n.part.add("svg"),document.adoptNode(n)):mi}catch{return mi}}}connectedCallback(){super.connectedCallback(),tn(this)}firstUpdated(t){super.firstUpdated(t),this.hasAttribute("rotate")&&this.style.setProperty("--rotate-angle",`${this.rotate}deg`),this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),en(this)}async getIconSource(){let t=tr(this.library),e=this.family||na();if(this.name&&t){let o=this.canvas==="auto"||this.autoWidth,i;try{i=await t.resolver(this.name,e,this.variant,o)}catch{i=void 0}return{url:i,fromLibrary:!0}}return{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){let{url:t,fromLibrary:e}=await this.getIconSource(),o=e?tr(this.library):void 0;if(!t){this.svg=null;return}let i=ca.get(t);i||(i=this.resolveIcon(t,o),ca.set(t,i));let r=await i;r===er&&ca.delete(t);let s=await this.getIconSource();if(t===s.url){if(rn(r)){this.svg=r;return}switch(r){case er:case mi:this.svg=null,this.dispatchEvent(new Ie);break;default:this.svg=r.cloneNode(!0),o?.mutator?.(this.svg,this),this.dispatchEvent(new Ao)}}}willUpdate(t){return this.style||this.setStyleProperty("--rotate-angle",`${this.rotate}deg`),super.willUpdate(t)}updated(t){super.updated(t);let e=tr(this.library);this.hasAttribute("rotate")&&this.style.setProperty("--rotate-angle",`${this.rotate}deg`);let o=this.shadowRoot?.querySelector("svg");o&&e?.mutator?.(o,this)}render(){return this.hasUpdated?this.svg:p`<svg part="svg" width="16" height="16" viewBox="0 0 16 16"></svg>`}};Tt.css=js;a([A()],Tt.prototype,"svg",2);a([l({reflect:!0})],Tt.prototype,"name",2);a([l({reflect:!0})],Tt.prototype,"family",2);a([l({reflect:!0})],Tt.prototype,"variant",2);a([l({reflect:!0})],Tt.prototype,"canvas",2);a([l({attribute:"auto-width",type:Boolean,reflect:!0})],Tt.prototype,"autoWidth",2);a([l({attribute:"swap-opacity",type:Boolean,reflect:!0})],Tt.prototype,"swapOpacity",2);a([l()],Tt.prototype,"src",2);a([l()],Tt.prototype,"label",2);a([l({reflect:!0})],Tt.prototype,"library",2);a([l({type:Number,reflect:!0})],Tt.prototype,"rotate",2);a([l({type:String,reflect:!0})],Tt.prototype,"flip",2);a([l({type:String,reflect:!0})],Tt.prototype,"animation",2);a([y("label")],Tt.prototype,"handleLabelChange",1);a([y(["family","name","library","variant","src","autoWidth","canvas","swapOpacity"],{waitUntilFirstUpdate:!0})],Tt.prototype,"setIcon",1);Tt=a([k("wa-icon")],Tt);var nn=C`
  :host {
    --control-box-size: 3rem;
    --icon-size: calc(var(--control-box-size) * 0.625);

    display: inline-flex;
    position: relative;
    cursor: pointer;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
  }

  img[aria-hidden='true'] {
    display: none;
  }

  .control-box {
    display: flex;
    position: absolute;
    align-items: center;
    justify-content: center;
    top: calc(50% - var(--control-box-size) / 2);
    right: calc(50% - var(--control-box-size) / 2);
    width: var(--control-box-size);
    height: var(--control-box-size);
    font-size: calc(var(--icon-size) * 0.75);
    background: none;
    border: solid var(--wa-border-width-s) currentColor;
    background-color: rgb(0 0 0 / 50%);
    border-radius: var(--wa-border-radius-circle);
    color: white;
    pointer-events: none;
    transition: opacity var(--wa-transition-normal) var(--wa-transition-easing);
  }

  @media (hover: hover) {
    :host([play]:hover) .control-box {
      opacity: 1;
    }
  }

  :where(:host([play]:not(:hover))) .control-box {
    opacity: 0;
  }

  :host([play]) slot[name='play-icon'],
  :host(:not([play])) slot[name='pause-icon'] {
    display: none;
  }

  /* Show control box on keyboard focus */
  .animated-image {
    &:focus {
      outline: none;
    }

    &:focus-visible .control-box {
      opacity: 1;
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }
`;var ln="important",Fh=" !"+ln,ct=io(class extends Me{constructor(t){if(super(t),t.type!==se.ATTRIBUTE||t.name!=="style"||t.strings?.length>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce((e,o)=>{let i=t[o];return i==null?e:e+`${o=o.includes("-")?o:o.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${i};`},"")}update(t,[e]){let{style:o}=t.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(e)),this.render(e);for(let i of this.ft)e[i]==null&&(this.ft.delete(i),i.includes("-")?o.removeProperty(i):o[i]=null);for(let i in e){let r=e[i];if(r!=null){this.ft.add(i);let s=typeof r=="string"&&r.endsWith(Fh);i.includes("-")||s?o.setProperty(i,s?r.slice(0,-11):r,s?ln:""):o[i]=r}}return Ot}});var ge=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.isLoaded=!1}handleClick(){this.play=!this.play}handleKeyDown(t){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.play=!this.play)}firstUpdated(t){if(super.firstUpdated,this.didSSR){let e=this.animatedImage;e&&e.complete&&(e.naturalWidth>0?e.dispatchEvent(new Event("load")):e.dispatchEvent(new Event("error")))}super.firstUpdated(t)}handleLoad(){let t=document.createElement("canvas"),{width:e,height:o}=this.animatedImage;t.width=e,t.height=o,t.getContext("2d").drawImage(this.animatedImage,0,0,e,o),this.frozenFrame=t.toDataURL("image/gif"),this.isLoaded||(this.dispatchEvent(new Ao),this.isLoaded=!0)}handleError(){this.dispatchEvent(new Ie)}handlePlayChange(){this.play&&(this.animatedImage.src="",this.animatedImage.src=this.src)}handleSrcChange(){this.isLoaded=!1}render(){let e=`${this.localize.term(this.play?"pauseAnimation":"playAnimation")} ${this.alt}`,o=this.didSSR&&!this.hasUpdated||this.play;return p`
      <div
        class="animated-image"
        tabindex="0"
        role="button"
        aria-pressed=${this.play?"true":"false"}
        aria-label=${e}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <img
          class="animated"
          src=${this.src}
          alt=${this.alt}
          crossorigin="anonymous"
          aria-hidden=${o?"false":"true"}
          style="visibility: hidden;"
          role="presentation"
          @load=${this.handleLoad}
          @error=${this.handleError}
        />

        ${this.isLoaded?p`
              <img
                class="frozen"
                src=${this.frozenFrame}
                alt=${this.alt}
                aria-hidden=${this.play?"true":"false"}
                role="presentation"
              />

              <div part="control-box" class="control-box" aria-hidden="true">
                <slot name="play-icon">
                  <wa-icon
                    name="play"
                    library="system"
                    variant="solid"
                    class="default"
                    style=${ct({"margin-inline-start":"3px"})}
                  ></wa-icon>
                </slot>
                <slot name="pause-icon">
                  <wa-icon name="pause" library="system" variant="solid" class="default"></wa-icon>
                </slot>
              </div>
            `:""}
      </div>
    `}};ge.css=nn;a([S(".animated")],ge.prototype,"animatedImage",2);a([A()],ge.prototype,"frozenFrame",2);a([A()],ge.prototype,"isLoaded",2);a([l()],ge.prototype,"src",2);a([l()],ge.prototype,"alt",2);a([l({type:Boolean,reflect:!0})],ge.prototype,"play",2);a([y("play",{waitUntilFirstUpdate:!0})],ge.prototype,"handlePlayChange",1);a([y("src")],ge.prototype,"handleSrcChange",1);ge=a([k("wa-animated-image")],ge);var ha=class extends Event{constructor(){super("wa-start",{bubbles:!0,cancelable:!1,composed:!0})}};var cn=class extends Event{constructor(){super("wa-finish",{bubbles:!0,cancelable:!1,composed:!0})}};var hn=class extends Event{constructor(){super("wa-cancel",{bubbles:!0,cancelable:!1,composed:!0})}};var dn=C`
  :host {
    display: contents;
  }
`;var jo={};mh(jo,{backInDown:()=>Jh,backInLeft:()=>td,backInRight:()=>ed,backInUp:()=>od,backOutDown:()=>id,backOutLeft:()=>rd,backOutRight:()=>ad,backOutUp:()=>sd,bounce:()=>Vh,bounceIn:()=>nd,bounceInDown:()=>ld,bounceInLeft:()=>cd,bounceInRight:()=>hd,bounceInUp:()=>dd,bounceOut:()=>pd,bounceOutDown:()=>ud,bounceOutLeft:()=>md,bounceOutRight:()=>fd,bounceOutUp:()=>gd,easings:()=>or,fadeIn:()=>bd,fadeInBottomLeft:()=>vd,fadeInBottomRight:()=>wd,fadeInDown:()=>yd,fadeInDownBig:()=>xd,fadeInLeft:()=>Cd,fadeInLeftBig:()=>kd,fadeInRight:()=>Sd,fadeInRightBig:()=>zd,fadeInTopLeft:()=>Ed,fadeInTopRight:()=>Ld,fadeInUp:()=>$d,fadeInUpBig:()=>Ad,fadeOut:()=>_d,fadeOutBottomLeft:()=>Td,fadeOutBottomRight:()=>Md,fadeOutDown:()=>Id,fadeOutDownBig:()=>Dd,fadeOutLeft:()=>Rd,fadeOutLeftBig:()=>Pd,fadeOutRight:()=>Od,fadeOutRightBig:()=>Bd,fadeOutTopLeft:()=>Fd,fadeOutTopRight:()=>Vd,fadeOutUp:()=>qd,fadeOutUpBig:()=>Wd,flash:()=>qh,flip:()=>Nd,flipInX:()=>Hd,flipInY:()=>Ud,flipOutX:()=>jd,flipOutY:()=>Kd,headShake:()=>Wh,heartBeat:()=>Nh,hinge:()=>gp,jackInTheBox:()=>bp,jello:()=>Hh,lightSpeedInLeft:()=>Xd,lightSpeedInRight:()=>Yd,lightSpeedOutLeft:()=>Gd,lightSpeedOutRight:()=>Zd,pulse:()=>Uh,rollIn:()=>vp,rollOut:()=>wp,rotateIn:()=>Qd,rotateInDownLeft:()=>Jd,rotateInDownRight:()=>tp,rotateInUpLeft:()=>ep,rotateInUpRight:()=>op,rotateOut:()=>ip,rotateOutDownLeft:()=>rp,rotateOutDownRight:()=>ap,rotateOutUpLeft:()=>sp,rotateOutUpRight:()=>np,rubberBand:()=>jh,shake:()=>Kh,shakeX:()=>Xh,shakeY:()=>Yh,slideInDown:()=>lp,slideInLeft:()=>cp,slideInRight:()=>hp,slideInUp:()=>dp,slideOutDown:()=>pp,slideOutLeft:()=>up,slideOutRight:()=>mp,slideOutUp:()=>fp,swing:()=>Gh,tada:()=>Zh,wobble:()=>Qh,zoomIn:()=>yp,zoomInDown:()=>xp,zoomInLeft:()=>Cp,zoomInRight:()=>kp,zoomInUp:()=>Sp,zoomOut:()=>zp,zoomOutDown:()=>Ep,zoomOutLeft:()=>Lp,zoomOutRight:()=>$p,zoomOutUp:()=>Ap});var Vh=[{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)",transform:"translate3d(0, 0, 0)"},{offset:.2,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)",transform:"translate3d(0, 0, 0)"},{offset:.4,easing:"cubic-bezier(0.755, 0.05, 0.855, 0.06)",transform:"translate3d(0, -30px, 0) scaleY(1.1)"},{offset:.43,easing:"cubic-bezier(0.755, 0.05, 0.855, 0.06)",transform:"translate3d(0, -30px, 0) scaleY(1.1)"},{offset:.53,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)",transform:"translate3d(0, 0, 0)"},{offset:.7,easing:"cubic-bezier(0.755, 0.05, 0.855, 0.06)",transform:"translate3d(0, -15px, 0) scaleY(1.05)"},{offset:.8,"transition-timing-function":"cubic-bezier(0.215, 0.61, 0.355, 1)",transform:"translate3d(0, 0, 0) scaleY(0.95)"},{offset:.9,transform:"translate3d(0, -4px, 0) scaleY(1.02)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)",transform:"translate3d(0, 0, 0)"}];var qh=[{offset:0,opacity:"1"},{offset:.25,opacity:"0"},{offset:.5,opacity:"1"},{offset:.75,opacity:"0"},{offset:1,opacity:"1"}];var Wh=[{offset:0,transform:"translateX(0)"},{offset:.065,transform:"translateX(-6px) rotateY(-9deg)"},{offset:.185,transform:"translateX(5px) rotateY(7deg)"},{offset:.315,transform:"translateX(-3px) rotateY(-5deg)"},{offset:.435,transform:"translateX(2px) rotateY(3deg)"},{offset:.5,transform:"translateX(0)"}];var Nh=[{offset:0,transform:"scale(1)"},{offset:.14,transform:"scale(1.3)"},{offset:.28,transform:"scale(1)"},{offset:.42,transform:"scale(1.3)"},{offset:.7,transform:"scale(1)"}];var Hh=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:.111,transform:"translate3d(0, 0, 0)"},{offset:.222,transform:"skewX(-12.5deg) skewY(-12.5deg)"},{offset:.33299999999999996,transform:"skewX(6.25deg) skewY(6.25deg)"},{offset:.444,transform:"skewX(-3.125deg) skewY(-3.125deg)"},{offset:.555,transform:"skewX(1.5625deg) skewY(1.5625deg)"},{offset:.6659999999999999,transform:"skewX(-0.78125deg) skewY(-0.78125deg)"},{offset:.777,transform:"skewX(0.390625deg) skewY(0.390625deg)"},{offset:.888,transform:"skewX(-0.1953125deg) skewY(-0.1953125deg)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Uh=[{offset:0,transform:"scale3d(1, 1, 1)"},{offset:.5,transform:"scale3d(1.05, 1.05, 1.05)"},{offset:1,transform:"scale3d(1, 1, 1)"}];var jh=[{offset:0,transform:"scale3d(1, 1, 1)"},{offset:.3,transform:"scale3d(1.25, 0.75, 1)"},{offset:.4,transform:"scale3d(0.75, 1.25, 1)"},{offset:.5,transform:"scale3d(1.15, 0.85, 1)"},{offset:.65,transform:"scale3d(0.95, 1.05, 1)"},{offset:.75,transform:"scale3d(1.05, 0.95, 1)"},{offset:1,transform:"scale3d(1, 1, 1)"}];var Kh=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:.1,transform:"translate3d(-10px, 0, 0)"},{offset:.2,transform:"translate3d(10px, 0, 0)"},{offset:.3,transform:"translate3d(-10px, 0, 0)"},{offset:.4,transform:"translate3d(10px, 0, 0)"},{offset:.5,transform:"translate3d(-10px, 0, 0)"},{offset:.6,transform:"translate3d(10px, 0, 0)"},{offset:.7,transform:"translate3d(-10px, 0, 0)"},{offset:.8,transform:"translate3d(10px, 0, 0)"},{offset:.9,transform:"translate3d(-10px, 0, 0)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Xh=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:.1,transform:"translate3d(-10px, 0, 0)"},{offset:.2,transform:"translate3d(10px, 0, 0)"},{offset:.3,transform:"translate3d(-10px, 0, 0)"},{offset:.4,transform:"translate3d(10px, 0, 0)"},{offset:.5,transform:"translate3d(-10px, 0, 0)"},{offset:.6,transform:"translate3d(10px, 0, 0)"},{offset:.7,transform:"translate3d(-10px, 0, 0)"},{offset:.8,transform:"translate3d(10px, 0, 0)"},{offset:.9,transform:"translate3d(-10px, 0, 0)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Yh=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:.1,transform:"translate3d(0, -10px, 0)"},{offset:.2,transform:"translate3d(0, 10px, 0)"},{offset:.3,transform:"translate3d(0, -10px, 0)"},{offset:.4,transform:"translate3d(0, 10px, 0)"},{offset:.5,transform:"translate3d(0, -10px, 0)"},{offset:.6,transform:"translate3d(0, 10px, 0)"},{offset:.7,transform:"translate3d(0, -10px, 0)"},{offset:.8,transform:"translate3d(0, 10px, 0)"},{offset:.9,transform:"translate3d(0, -10px, 0)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Gh=[{offset:.2,transform:"rotate3d(0, 0, 1, 15deg)"},{offset:.4,transform:"rotate3d(0, 0, 1, -10deg)"},{offset:.6,transform:"rotate3d(0, 0, 1, 5deg)"},{offset:.8,transform:"rotate3d(0, 0, 1, -5deg)"},{offset:1,transform:"rotate3d(0, 0, 1, 0deg)"}];var Zh=[{offset:0,transform:"scale3d(1, 1, 1)"},{offset:.1,transform:"scale3d(0.9, 0.9, 0.9) rotate3d(0, 0, 1, -3deg)"},{offset:.2,transform:"scale3d(0.9, 0.9, 0.9) rotate3d(0, 0, 1, -3deg)"},{offset:.3,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)"},{offset:.4,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)"},{offset:.5,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)"},{offset:.6,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)"},{offset:.7,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)"},{offset:.8,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)"},{offset:.9,transform:"scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)"},{offset:1,transform:"scale3d(1, 1, 1)"}];var Qh=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:.15,transform:"translate3d(-25%, 0, 0) rotate3d(0, 0, 1, -5deg)"},{offset:.3,transform:"translate3d(20%, 0, 0) rotate3d(0, 0, 1, 3deg)"},{offset:.45,transform:"translate3d(-15%, 0, 0) rotate3d(0, 0, 1, -3deg)"},{offset:.6,transform:"translate3d(10%, 0, 0) rotate3d(0, 0, 1, 2deg)"},{offset:.75,transform:"translate3d(-5%, 0, 0) rotate3d(0, 0, 1, -1deg)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Jh=[{offset:0,transform:"translateY(-1200px) scale(0.7)",opacity:"0.7"},{offset:.8,transform:"translateY(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"scale(1)",opacity:"1"}];var td=[{offset:0,transform:"translateX(-2000px) scale(0.7)",opacity:"0.7"},{offset:.8,transform:"translateX(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"scale(1)",opacity:"1"}];var ed=[{offset:0,transform:"translateX(2000px) scale(0.7)",opacity:"0.7"},{offset:.8,transform:"translateX(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"scale(1)",opacity:"1"}];var od=[{offset:0,transform:"translateY(1200px) scale(0.7)",opacity:"0.7"},{offset:.8,transform:"translateY(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"scale(1)",opacity:"1"}];var id=[{offset:0,transform:"scale(1)",opacity:"1"},{offset:.2,transform:"translateY(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"translateY(700px) scale(0.7)",opacity:"0.7"}];var rd=[{offset:0,transform:"scale(1)",opacity:"1"},{offset:.2,transform:"translateX(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"translateX(-2000px) scale(0.7)",opacity:"0.7"}];var ad=[{offset:0,transform:"scale(1)",opacity:"1"},{offset:.2,transform:"translateX(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"translateX(2000px) scale(0.7)",opacity:"0.7"}];var sd=[{offset:0,transform:"scale(1)",opacity:"1"},{offset:.2,transform:"translateY(0px) scale(0.7)",opacity:"0.7"},{offset:1,transform:"translateY(-700px) scale(0.7)",opacity:"0.7"}];var nd=[{offset:0,opacity:"0",transform:"scale3d(0.3, 0.3, 0.3)"},{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.2,transform:"scale3d(1.1, 1.1, 1.1)"},{offset:.2,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.4,transform:"scale3d(0.9, 0.9, 0.9)"},{offset:.4,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.6,opacity:"1",transform:"scale3d(1.03, 1.03, 1.03)"},{offset:.6,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.8,transform:"scale3d(0.97, 0.97, 0.97)"},{offset:.8,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:1,opacity:"1",transform:"scale3d(1, 1, 1)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"}];var ld=[{offset:0,opacity:"0",transform:"translate3d(0, -3000px, 0) scaleY(3)"},{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.6,opacity:"1",transform:"translate3d(0, 25px, 0) scaleY(0.9)"},{offset:.6,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.75,transform:"translate3d(0, -10px, 0) scaleY(0.95)"},{offset:.75,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.9,transform:"translate3d(0, 5px, 0) scaleY(0.985)"},{offset:.9,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:1,transform:"translate3d(0, 0, 0)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"}];var cd=[{offset:0,opacity:"0",transform:"translate3d(-3000px, 0, 0) scaleX(3)"},{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.6,opacity:"1",transform:"translate3d(25px, 0, 0) scaleX(1)"},{offset:.6,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.75,transform:"translate3d(-10px, 0, 0) scaleX(0.98)"},{offset:.75,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.9,transform:"translate3d(5px, 0, 0) scaleX(0.995)"},{offset:.9,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:1,transform:"translate3d(0, 0, 0)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"}];var hd=[{offset:0,opacity:"0",transform:"translate3d(3000px, 0, 0) scaleX(3)"},{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.6,opacity:"1",transform:"translate3d(-25px, 0, 0) scaleX(1)"},{offset:.6,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.75,transform:"translate3d(10px, 0, 0) scaleX(0.98)"},{offset:.75,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.9,transform:"translate3d(-5px, 0, 0) scaleX(0.995)"},{offset:.9,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:1,transform:"translate3d(0, 0, 0)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"}];var dd=[{offset:0,opacity:"0",transform:"translate3d(0, 3000px, 0) scaleY(5)"},{offset:0,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.6,opacity:"1",transform:"translate3d(0, -20px, 0) scaleY(0.9)"},{offset:.6,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.75,transform:"translate3d(0, 10px, 0) scaleY(0.95)"},{offset:.75,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:.9,transform:"translate3d(0, -5px, 0) scaleY(0.985)"},{offset:.9,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"},{offset:1,transform:"translate3d(0, 0, 0)"},{offset:1,easing:"cubic-bezier(0.215, 0.61, 0.355, 1)"}];var pd=[{offset:.2,transform:"scale3d(0.9, 0.9, 0.9)"},{offset:.5,opacity:"1",transform:"scale3d(1.1, 1.1, 1.1)"},{offset:.55,opacity:"1",transform:"scale3d(1.1, 1.1, 1.1)"},{offset:1,opacity:"0",transform:"scale3d(0.3, 0.3, 0.3)"}];var ud=[{offset:.2,transform:"translate3d(0, 10px, 0) scaleY(0.985)"},{offset:.4,opacity:"1",transform:"translate3d(0, -20px, 0) scaleY(0.9)"},{offset:.45,opacity:"1",transform:"translate3d(0, -20px, 0) scaleY(0.9)"},{offset:1,opacity:"0",transform:"translate3d(0, 2000px, 0) scaleY(3)"}];var md=[{offset:.2,opacity:"1",transform:"translate3d(20px, 0, 0) scaleX(0.9)"},{offset:1,opacity:"0",transform:"translate3d(-2000px, 0, 0) scaleX(2)"}];var fd=[{offset:.2,opacity:"1",transform:"translate3d(-20px, 0, 0) scaleX(0.9)"},{offset:1,opacity:"0",transform:"translate3d(2000px, 0, 0) scaleX(2)"}];var gd=[{offset:.2,transform:"translate3d(0, -10px, 0) scaleY(0.985)"},{offset:.4,opacity:"1",transform:"translate3d(0, 20px, 0) scaleY(0.9)"},{offset:.45,opacity:"1",transform:"translate3d(0, 20px, 0) scaleY(0.9)"},{offset:1,opacity:"0",transform:"translate3d(0, -2000px, 0) scaleY(3)"}];var bd=[{offset:0,opacity:"0"},{offset:1,opacity:"1"}];var vd=[{offset:0,opacity:"0",transform:"translate3d(-100%, 100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var wd=[{offset:0,opacity:"0",transform:"translate3d(100%, 100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var yd=[{offset:0,opacity:"0",transform:"translate3d(0, -100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var xd=[{offset:0,opacity:"0",transform:"translate3d(0, -2000px, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var Cd=[{offset:0,opacity:"0",transform:"translate3d(-100%, 0, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var kd=[{offset:0,opacity:"0",transform:"translate3d(-2000px, 0, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var Sd=[{offset:0,opacity:"0",transform:"translate3d(100%, 0, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var zd=[{offset:0,opacity:"0",transform:"translate3d(2000px, 0, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var Ed=[{offset:0,opacity:"0",transform:"translate3d(-100%, -100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var Ld=[{offset:0,opacity:"0",transform:"translate3d(100%, -100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var $d=[{offset:0,opacity:"0",transform:"translate3d(0, 100%, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var Ad=[{offset:0,opacity:"0",transform:"translate3d(0, 2000px, 0)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var _d=[{offset:0,opacity:"1"},{offset:1,opacity:"0"}];var Td=[{offset:0,opacity:"1",transform:"translate3d(0, 0, 0)"},{offset:1,opacity:"0",transform:"translate3d(-100%, 100%, 0)"}];var Md=[{offset:0,opacity:"1",transform:"translate3d(0, 0, 0)"},{offset:1,opacity:"0",transform:"translate3d(100%, 100%, 0)"}];var Id=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(0, 100%, 0)"}];var Dd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(0, 2000px, 0)"}];var Rd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(-100%, 0, 0)"}];var Pd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(-2000px, 0, 0)"}];var Od=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(100%, 0, 0)"}];var Bd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(2000px, 0, 0)"}];var Fd=[{offset:0,opacity:"1",transform:"translate3d(0, 0, 0)"},{offset:1,opacity:"0",transform:"translate3d(-100%, -100%, 0)"}];var Vd=[{offset:0,opacity:"1",transform:"translate3d(0, 0, 0)"},{offset:1,opacity:"0",transform:"translate3d(100%, -100%, 0)"}];var qd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(0, -100%, 0)"}];var Wd=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(0, -2000px, 0)"}];var Nd=[{offset:0,transform:"perspective(400px) scale3d(1, 1, 1) translate3d(0, 0, 0) rotate3d(0, 1, 0, -360deg)",easing:"ease-out"},{offset:.4,transform:`perspective(400px) scale3d(1, 1, 1) translate3d(0, 0, 150px)
      rotate3d(0, 1, 0, -190deg)`,easing:"ease-out"},{offset:.5,transform:`perspective(400px) scale3d(1, 1, 1) translate3d(0, 0, 150px)
      rotate3d(0, 1, 0, -170deg)`,easing:"ease-in"},{offset:.8,transform:`perspective(400px) scale3d(0.95, 0.95, 0.95) translate3d(0, 0, 0)
      rotate3d(0, 1, 0, 0deg)`,easing:"ease-in"},{offset:1,transform:"perspective(400px) scale3d(1, 1, 1) translate3d(0, 0, 0) rotate3d(0, 1, 0, 0deg)",easing:"ease-in"}];var Hd=[{offset:0,transform:"perspective(400px) rotate3d(1, 0, 0, 90deg)",easing:"ease-in",opacity:"0"},{offset:.4,transform:"perspective(400px) rotate3d(1, 0, 0, -20deg)",easing:"ease-in"},{offset:.6,transform:"perspective(400px) rotate3d(1, 0, 0, 10deg)",opacity:"1"},{offset:.8,transform:"perspective(400px) rotate3d(1, 0, 0, -5deg)"},{offset:1,transform:"perspective(400px)"}];var Ud=[{offset:0,transform:"perspective(400px) rotate3d(0, 1, 0, 90deg)",easing:"ease-in",opacity:"0"},{offset:.4,transform:"perspective(400px) rotate3d(0, 1, 0, -20deg)",easing:"ease-in"},{offset:.6,transform:"perspective(400px) rotate3d(0, 1, 0, 10deg)",opacity:"1"},{offset:.8,transform:"perspective(400px) rotate3d(0, 1, 0, -5deg)"},{offset:1,transform:"perspective(400px)"}];var jd=[{offset:0,transform:"perspective(400px)"},{offset:.3,transform:"perspective(400px) rotate3d(1, 0, 0, -20deg)",opacity:"1"},{offset:1,transform:"perspective(400px) rotate3d(1, 0, 0, 90deg)",opacity:"0"}];var Kd=[{offset:0,transform:"perspective(400px)"},{offset:.3,transform:"perspective(400px) rotate3d(0, 1, 0, -15deg)",opacity:"1"},{offset:1,transform:"perspective(400px) rotate3d(0, 1, 0, 90deg)",opacity:"0"}];var Xd=[{offset:0,transform:"translate3d(-100%, 0, 0) skewX(30deg)",opacity:"0"},{offset:.6,transform:"skewX(-20deg)",opacity:"1"},{offset:.8,transform:"skewX(5deg)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Yd=[{offset:0,transform:"translate3d(100%, 0, 0) skewX(-30deg)",opacity:"0"},{offset:.6,transform:"skewX(20deg)",opacity:"1"},{offset:.8,transform:"skewX(-5deg)"},{offset:1,transform:"translate3d(0, 0, 0)"}];var Gd=[{offset:0,opacity:"1"},{offset:1,transform:"translate3d(-100%, 0, 0) skewX(-30deg)",opacity:"0"}];var Zd=[{offset:0,opacity:"1"},{offset:1,transform:"translate3d(100%, 0, 0) skewX(30deg)",opacity:"0"}];var Qd=[{offset:0,transform:"rotate3d(0, 0, 1, -200deg)",opacity:"0"},{offset:1,transform:"translate3d(0, 0, 0)",opacity:"1"}];var Jd=[{offset:0,transform:"rotate3d(0, 0, 1, -45deg)",opacity:"0"},{offset:1,transform:"translate3d(0, 0, 0)",opacity:"1"}];var tp=[{offset:0,transform:"rotate3d(0, 0, 1, 45deg)",opacity:"0"},{offset:1,transform:"translate3d(0, 0, 0)",opacity:"1"}];var ep=[{offset:0,transform:"rotate3d(0, 0, 1, 45deg)",opacity:"0"},{offset:1,transform:"translate3d(0, 0, 0)",opacity:"1"}];var op=[{offset:0,transform:"rotate3d(0, 0, 1, -90deg)",opacity:"0"},{offset:1,transform:"translate3d(0, 0, 0)",opacity:"1"}];var ip=[{offset:0,opacity:"1"},{offset:1,transform:"rotate3d(0, 0, 1, 200deg)",opacity:"0"}];var rp=[{offset:0,opacity:"1"},{offset:1,transform:"rotate3d(0, 0, 1, 45deg)",opacity:"0"}];var ap=[{offset:0,opacity:"1"},{offset:1,transform:"rotate3d(0, 0, 1, -45deg)",opacity:"0"}];var sp=[{offset:0,opacity:"1"},{offset:1,transform:"rotate3d(0, 0, 1, -45deg)",opacity:"0"}];var np=[{offset:0,opacity:"1"},{offset:1,transform:"rotate3d(0, 0, 1, 90deg)",opacity:"0"}];var lp=[{offset:0,transform:"translate3d(0, -100%, 0)",visibility:"visible"},{offset:1,transform:"translate3d(0, 0, 0)"}];var cp=[{offset:0,transform:"translate3d(-100%, 0, 0)",visibility:"visible"},{offset:1,transform:"translate3d(0, 0, 0)"}];var hp=[{offset:0,transform:"translate3d(100%, 0, 0)",visibility:"visible"},{offset:1,transform:"translate3d(0, 0, 0)"}];var dp=[{offset:0,transform:"translate3d(0, 100%, 0)",visibility:"visible"},{offset:1,transform:"translate3d(0, 0, 0)"}];var pp=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:1,visibility:"hidden",transform:"translate3d(0, 100%, 0)"}];var up=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:1,visibility:"hidden",transform:"translate3d(-100%, 0, 0)"}];var mp=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:1,visibility:"hidden",transform:"translate3d(100%, 0, 0)"}];var fp=[{offset:0,transform:"translate3d(0, 0, 0)"},{offset:1,visibility:"hidden",transform:"translate3d(0, -100%, 0)"}];var gp=[{offset:0,easing:"ease-in-out"},{offset:.2,transform:"rotate3d(0, 0, 1, 80deg)",easing:"ease-in-out"},{offset:.4,transform:"rotate3d(0, 0, 1, 60deg)",easing:"ease-in-out",opacity:"1"},{offset:.6,transform:"rotate3d(0, 0, 1, 80deg)",easing:"ease-in-out"},{offset:.8,transform:"rotate3d(0, 0, 1, 60deg)",easing:"ease-in-out",opacity:"1"},{offset:1,transform:"translate3d(0, 700px, 0)",opacity:"0"}];var bp=[{offset:0,opacity:"0",transform:"scale(0.1) rotate(30deg)","transform-origin":"center bottom"},{offset:.5,transform:"rotate(-10deg)"},{offset:.7,transform:"rotate(3deg)"},{offset:1,opacity:"1",transform:"scale(1)"}];var vp=[{offset:0,opacity:"0",transform:"translate3d(-100%, 0, 0) rotate3d(0, 0, 1, -120deg)"},{offset:1,opacity:"1",transform:"translate3d(0, 0, 0)"}];var wp=[{offset:0,opacity:"1"},{offset:1,opacity:"0",transform:"translate3d(100%, 0, 0) rotate3d(0, 0, 1, 120deg)"}];var yp=[{offset:0,opacity:"0",transform:"scale3d(0.3, 0.3, 0.3)"},{offset:.5,opacity:"1"}];var xp=[{offset:0,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(0, -1000px, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:.6,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(0, 60px, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var Cp=[{offset:0,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(-1000px, 0, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:.6,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(10px, 0, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var kp=[{offset:0,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(1000px, 0, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:.6,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(-10px, 0, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var Sp=[{offset:0,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(0, 1000px, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:.6,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(0, -60px, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var zp=[{offset:0,opacity:"1"},{offset:.5,opacity:"0",transform:"scale3d(0.3, 0.3, 0.3)"},{offset:1,opacity:"0"}];var Ep=[{offset:.4,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(0, -60px, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:1,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(0, 2000px, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var Lp=[{offset:.4,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(42px, 0, 0)"},{offset:1,opacity:"0",transform:"scale(0.1) translate3d(-2000px, 0, 0)"}];var $p=[{offset:.4,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(-42px, 0, 0)"},{offset:1,opacity:"0",transform:"scale(0.1) translate3d(2000px, 0, 0)"}];var Ap=[{offset:.4,opacity:"1",transform:"scale3d(0.475, 0.475, 0.475) translate3d(0, 60px, 0)",easing:"cubic-bezier(0.55, 0.055, 0.675, 0.19)"},{offset:1,opacity:"0",transform:"scale3d(0.1, 0.1, 0.1) translate3d(0, -2000px, 0)",easing:"cubic-bezier(0.175, 0.885, 0.32, 1)"}];var or={linear:"linear",ease:"ease",easeIn:"ease-in",easeOut:"ease-out",easeInOut:"ease-in-out",easeInSine:"cubic-bezier(0.47, 0, 0.745, 0.715)",easeOutSine:"cubic-bezier(0.39, 0.575, 0.565, 1)",easeInOutSine:"cubic-bezier(0.445, 0.05, 0.55, 0.95)",easeInQuad:"cubic-bezier(0.55, 0.085, 0.68, 0.53)",easeOutQuad:"cubic-bezier(0.25, 0.46, 0.45, 0.94)",easeInOutQuad:"cubic-bezier(0.455, 0.03, 0.515, 0.955)",easeInCubic:"cubic-bezier(0.55, 0.055, 0.675, 0.19)",easeOutCubic:"cubic-bezier(0.215, 0.61, 0.355, 1)",easeInOutCubic:"cubic-bezier(0.645, 0.045, 0.355, 1)",easeInQuart:"cubic-bezier(0.895, 0.03, 0.685, 0.22)",easeOutQuart:"cubic-bezier(0.165, 0.84, 0.44, 1)",easeInOutQuart:"cubic-bezier(0.77, 0, 0.175, 1)",easeInQuint:"cubic-bezier(0.755, 0.05, 0.855, 0.06)",easeOutQuint:"cubic-bezier(0.23, 1, 0.32, 1)",easeInOutQuint:"cubic-bezier(0.86, 0, 0.07, 1)",easeInExpo:"cubic-bezier(0.95, 0.05, 0.795, 0.035)",easeOutExpo:"cubic-bezier(0.19, 1, 0.22, 1)",easeInOutExpo:"cubic-bezier(1, 0, 0, 1)",easeInCirc:"cubic-bezier(0.6, 0.04, 0.98, 0.335)",easeOutCirc:"cubic-bezier(0.075, 0.82, 0.165, 1)",easeInOutCirc:"cubic-bezier(0.785, 0.135, 0.15, 0.86)",easeInBack:"cubic-bezier(0.6, -0.28, 0.735, 0.045)",easeOutBack:"cubic-bezier(0.175, 0.885, 0.32, 1.275)",easeInOutBack:"cubic-bezier(0.68, -0.55, 0.265, 1.55)"};function _p(){return Object.entries(jo).filter(([t])=>t!=="easings").map(([t])=>t)}function Tp(){return Object.entries(or).map(([t])=>t)}var $t=class extends E{constructor(){super(...arguments),this.hasStarted=!1,this.name="none",this.play=!1,this.delay=0,this.direction="normal",this.duration=1e3,this.easing="linear",this.endDelay=0,this.fill="auto",this.iterations=1/0,this.iterationStart=0,this.playbackRate=1,this.handleAnimationFinish=()=>{this.play=!1,this.hasStarted=!1,this.dispatchEvent(new cn)},this.handleAnimationCancel=()=>{this.play=!1,this.hasStarted=!1,this.dispatchEvent(new hn)}}get currentTime(){return this.animation?.currentTime??0}set currentTime(t){this.animation&&(this.animation.currentTime=t)}connectedCallback(){super.connectedCallback(),"animate"in this&&this.createAnimation()}disconnectedCallback(){super.disconnectedCallback(),"animate"in this&&this.destroyAnimation()}handleSlotChange(){this.destroyAnimation(),this.createAnimation()}async createAnimation(){let t=jo.easings[this.easing]??this.easing,e=this.keyframes??jo[this.name],i=(await this.defaultSlot).assignedElements()[0];return!i||!e?!1:(this.destroyAnimation(),this.animation=i.animate(e,{delay:this.delay,direction:this.direction,duration:this.duration,easing:t,endDelay:this.endDelay,fill:this.fill,iterationStart:this.iterationStart,iterations:this.iterations}),this.animation.playbackRate=this.playbackRate,this.animation.addEventListener("cancel",this.handleAnimationCancel),this.animation.addEventListener("finish",this.handleAnimationFinish),this.play?(this.hasStarted=!0,this.dispatchEvent(new ha)):this.animation.pause(),!0)}destroyAnimation(){this.animation&&(this.animation.cancel(),this.animation.removeEventListener("cancel",this.handleAnimationCancel),this.animation.removeEventListener("finish",this.handleAnimationFinish),this.hasStarted=!1)}handleAnimationChange(){this.hasUpdated&&this.createAnimation()}handlePlayChange(){return this.animation?(this.play&&!this.hasStarted&&(this.hasStarted=!0,this.dispatchEvent(new ha)),this.play?this.animation.play():this.animation.pause(),!0):!1}handlePlaybackRateChange(){this.animation&&(this.animation.playbackRate=this.playbackRate)}cancel(){this.animation?.cancel()}finish(){this.animation?.finish()}render(){return p` <slot @slotchange=${this.handleSlotChange}></slot> `}};$t.css=dn;a([Ps("slot")],$t.prototype,"defaultSlot",2);a([l()],$t.prototype,"name",2);a([l({type:Boolean,reflect:!0})],$t.prototype,"play",2);a([l({type:Number})],$t.prototype,"delay",2);a([l()],$t.prototype,"direction",2);a([l({type:Number})],$t.prototype,"duration",2);a([l()],$t.prototype,"easing",2);a([l({attribute:"end-delay",type:Number})],$t.prototype,"endDelay",2);a([l()],$t.prototype,"fill",2);a([l({type:Number})],$t.prototype,"iterations",2);a([l({attribute:"iteration-start",type:Number})],$t.prototype,"iterationStart",2);a([l({attribute:!1})],$t.prototype,"keyframes",2);a([l({attribute:"playback-rate",type:Number})],$t.prototype,"playbackRate",2);a([y(["name","delay","direction","duration","easing","endDelay","fill","iterations","iterationsStart","keyframes"])],$t.prototype,"handleAnimationChange",1);a([y("play")],$t.prototype,"handlePlayChange",1);a([y("playbackRate")],$t.prototype,"handlePlaybackRateChange",1);$t=a([k("wa-animation")],$t);var pn=C`
  :host {
    --size: 3rem;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: var(--size);
    height: var(--size);
    color: var(--wa-color-neutral-on-normal);
    font: inherit;
    font-size: calc(var(--size) * 0.4);
    vertical-align: middle;
    background-color: var(--wa-color-neutral-fill-normal);
    border-radius: var(--wa-border-radius-circle);
    user-select: none;
    -webkit-user-select: none;
  }

  :host([shape='square']) {
    border-radius: 0;
  }

  :host([shape='rounded']) {
    border-radius: var(--wa-border-radius-m);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .initials {
    line-height: 1;
    text-transform: uppercase;
  }

  .image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    overflow: hidden;
    border-radius: inherit;
  }
`;var Se=class extends E{constructor(){super(...arguments),this.hasError=!1,this.image="",this.label="",this.initials="",this.loading="eager",this.shape="circle"}handleImageChange(){this.hasError=!1}handleImageLoadError(){this.hasError=!0,this.dispatchEvent(new Ie)}connectedCallback(){if(super.connectedCallback(),this.didSSR){let t=this.shadowRoot?.querySelector?.("img");t&&t.complete&&t.naturalWidth<=0&&this.updateComplete.then(()=>{this.handleImageLoadError()})}}render(){let t=p`
      <img
        part="image"
        class="image"
        src="${this.image}"
        loading="${this.loading}"
        role="img"
        aria-label=${this.label}
        @error="${this.handleImageLoadError}"
      />
    `,e=p``;return this.initials?e=p`<div part="initials" class="initials" role="img" aria-label=${this.label}>
        ${this.initials}
      </div>`:e=p`
        <slot name="icon" part="icon" class="icon" role="img" aria-label=${this.label}>
          <wa-icon name="user" library="system" variant="solid"></wa-icon>
        </slot>
      `,p` ${this.image&&!this.hasError?t:e} `}};Se.css=pn;a([A()],Se.prototype,"hasError",2);a([l()],Se.prototype,"image",2);a([l()],Se.prototype,"label",2);a([l()],Se.prototype,"initials",2);a([l()],Se.prototype,"loading",2);a([l({reflect:!0})],Se.prototype,"shape",2);a([y("image")],Se.prototype,"handleImageChange",1);Se=a([k("wa-avatar")],Se);var De=C`
  :where(:root),
  .wa-neutral,
  :host([variant='neutral']) {
    --wa-color-fill-loud: var(--wa-color-neutral-fill-loud);
    --wa-color-fill-normal: var(--wa-color-neutral-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-neutral-fill-quiet);
    --wa-color-border-loud: var(--wa-color-neutral-border-loud);
    --wa-color-border-normal: var(--wa-color-neutral-border-normal);
    --wa-color-border-quiet: var(--wa-color-neutral-border-quiet);
    --wa-color-on-loud: var(--wa-color-neutral-on-loud);
    --wa-color-on-normal: var(--wa-color-neutral-on-normal);
    --wa-color-on-quiet: var(--wa-color-neutral-on-quiet);
  }

  .wa-brand,
  :host([variant='brand']) {
    --wa-color-fill-loud: var(--wa-color-brand-fill-loud);
    --wa-color-fill-normal: var(--wa-color-brand-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-brand-fill-quiet);
    --wa-color-border-loud: var(--wa-color-brand-border-loud);
    --wa-color-border-normal: var(--wa-color-brand-border-normal);
    --wa-color-border-quiet: var(--wa-color-brand-border-quiet);
    --wa-color-on-loud: var(--wa-color-brand-on-loud);
    --wa-color-on-normal: var(--wa-color-brand-on-normal);
    --wa-color-on-quiet: var(--wa-color-brand-on-quiet);
  }

  .wa-success,
  :host([variant='success']) {
    --wa-color-fill-loud: var(--wa-color-success-fill-loud);
    --wa-color-fill-normal: var(--wa-color-success-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-success-fill-quiet);
    --wa-color-border-loud: var(--wa-color-success-border-loud);
    --wa-color-border-normal: var(--wa-color-success-border-normal);
    --wa-color-border-quiet: var(--wa-color-success-border-quiet);
    --wa-color-on-loud: var(--wa-color-success-on-loud);
    --wa-color-on-normal: var(--wa-color-success-on-normal);
    --wa-color-on-quiet: var(--wa-color-success-on-quiet);
  }

  .wa-warning,
  :host([variant='warning']) {
    --wa-color-fill-loud: var(--wa-color-warning-fill-loud);
    --wa-color-fill-normal: var(--wa-color-warning-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-warning-fill-quiet);
    --wa-color-border-loud: var(--wa-color-warning-border-loud);
    --wa-color-border-normal: var(--wa-color-warning-border-normal);
    --wa-color-border-quiet: var(--wa-color-warning-border-quiet);
    --wa-color-on-loud: var(--wa-color-warning-on-loud);
    --wa-color-on-normal: var(--wa-color-warning-on-normal);
    --wa-color-on-quiet: var(--wa-color-warning-on-quiet);
  }

  .wa-danger,
  :host([variant='danger']) {
    --wa-color-fill-loud: var(--wa-color-danger-fill-loud);
    --wa-color-fill-normal: var(--wa-color-danger-fill-normal);
    --wa-color-fill-quiet: var(--wa-color-danger-fill-quiet);
    --wa-color-border-loud: var(--wa-color-danger-border-loud);
    --wa-color-border-normal: var(--wa-color-danger-border-normal);
    --wa-color-border-quiet: var(--wa-color-danger-border-quiet);
    --wa-color-on-loud: var(--wa-color-danger-on-loud);
    --wa-color-on-normal: var(--wa-color-danger-on-normal);
    --wa-color-on-quiet: var(--wa-color-danger-on-quiet);
  }
`;var un=C`
  :host {
    --pulse-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));

    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375em 0.625em;
    color: var(--wa-color-on-loud, var(--wa-color-brand-on-loud));
    font-size: max(var(--wa-font-size-3xs), 0.75em);
    font-weight: var(--wa-font-weight-semibold);
    line-height: 1;
    vertical-align: middle;
    white-space: nowrap;
    background-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));
    border-color: transparent;
    border-radius: var(--wa-border-radius-s);
    border-style: var(--wa-border-style);
    border-width: var(--wa-border-width-s);
    user-select: none;
    -webkit-user-select: none;
    cursor: inherit;

    min-width: 1.25em; /* <-- this is what Safari respects for intrinsic */
    min-height: 1em;
  }

  /* Appearance modifiers */
  :host([appearance='outlined']) {
    --pulse-color: var(--wa-color-border-loud, var(--wa-color-brand-border-loud));

    color: var(--wa-color-on-quiet, var(--wa-color-brand-on-quiet));
    background-color: transparent;
    border-color: var(--wa-color-border-loud, var(--wa-color-brand-border-loud));
  }

  :host([appearance='filled']) {
    --pulse-color: var(--wa-color-fill-normal, var(--wa-color-brand-fill-normal));

    color: var(--wa-color-on-normal, var(--wa-color-brand-on-normal));
    background-color: var(--wa-color-fill-normal, var(--wa-color-brand-fill-normal));
    border-color: transparent;
  }

  :host([appearance='filled-outlined']) {
    --pulse-color: var(--wa-color-border-normal, var(--wa-color-brand-border-normal));

    color: var(--wa-color-on-normal, var(--wa-color-brand-on-normal));
    background-color: var(--wa-color-fill-normal, var(--wa-color-brand-fill-normal));
    border-color: var(--wa-color-border-normal, var(--wa-color-brand-border-normal));
  }

  :host([appearance='accent']) {
    --pulse-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));

    color: var(--wa-color-on-loud, var(--wa-color-brand-on-loud));
    background-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));
    border-color: transparent;
  }

  /* Pill modifier */
  :host([pill]) {
    border-radius: var(--wa-border-radius-pill);
  }

  /* Pulse attention */
  :host([attention='pulse']) {
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 var(--pulse-color);
    }
    70% {
      box-shadow: 0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  /* Bounce attention */
  :host([attention='bounce']) {
    animation: bounce 1s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
  }

  @keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-5px);
    }
    60% {
      transform: translateY(-2px);
    }
  }

  /* Prevents vertical space when icons with vertical-align are slotted in - https://github.com/shoelace-style/webawesome/issues/2280 */
  [part='start'],
  [part='end'] {
    line-height: 0;
  }

  slot[name='start']::slotted(*) {
    margin-inline-end: 0.375em;
  }

  slot[name='end']::slotted(*) {
    margin-inline-start: 0.375em;
  }
`;var ro=class extends E{constructor(){super(...arguments),this.variant="brand",this.appearance="accent",this.pill=!1,this.attention="none"}render(){return p`
      <span part="start">
        <slot name="start"></slot>
      </span>

      <span part="base badge" role="status">
        <slot></slot>
      </span>

      <span part="end">
        <slot name="end"></slot>
      </span>
    `}};ro.css=[De,un];a([l({reflect:!0})],ro.prototype,"variant",2);a([l({reflect:!0})],ro.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],ro.prototype,"pill",2);a([l({reflect:!0})],ro.prototype,"attention",2);ro=a([k("wa-badge")],ro);var mn=C`
  .breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
`;var _o=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.separatorDir=this.localize.dir(),this.label=""}getSeparator(){let e=this.separatorSlot.assignedElements({flatten:!0})[0].cloneNode(!0);return[e,...e.querySelectorAll("[id]")].forEach(o=>o.removeAttribute("id")),e.setAttribute("data-default",""),e.slot="separator",e}handleSlotChange(){let t=[...this.defaultSlot.assignedElements({flatten:!0})].filter(e=>e.tagName.toLowerCase()==="wa-breadcrumb-item");t.forEach((e,o)=>{let i=e.querySelector('[slot="separator"]');i===null?e.append(this.getSeparator()):i.hasAttribute("data-default")&&i.replaceWith(this.getSeparator()),o===t.length-1?e.setAttribute("aria-current","page"):e.removeAttribute("aria-current")})}render(){return this.separatorDir!==this.localize.dir()&&(this.separatorDir=this.localize.dir(),this.updateComplete.then(()=>this.handleSlotChange())),p`
      <nav part="base breadcrumb" class="breadcrumb" aria-label=${this.label}>
        <slot @slotchange=${this.handleSlotChange}></slot>
      </nav>

      <span hidden aria-hidden="true">
        <slot name="separator">
          <wa-icon
            name=${this.localize.dir()==="rtl"?"chevron-left":"chevron-right"}
            library="system"
            variant="solid"
          ></wa-icon>
        </slot>
      </span>
    `}};_o.css=mn;a([S("slot")],_o.prototype,"defaultSlot",2);a([S('slot[name="separator"]')],_o.prototype,"separatorSlot",2);a([l()],_o.prototype,"label",2);_o=a([k("wa-breadcrumb")],_o);var fn=C`
  :host {
    color: var(--wa-color-text-link);
    display: inline-flex;
    align-items: center;
    font: inherit;
    font-weight: var(--wa-font-weight-action);
    line-height: var(--wa-line-height-normal);
    white-space: nowrap;
  }

  :host(:last-of-type) {
    color: var(--wa-color-text-quiet);
  }

  .label {
    display: inline-block;
    font: inherit;
    text-decoration: none;
    color: currentColor;
    background: none;
    border: none;
    border-radius: var(--wa-border-radius-m);
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition: color var(--wa-transition-normal) var(--wa-transition-easing);
  }

  @media (hover: hover) {
    :host(:not(:last-of-type)) .label:hover {
      color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
    }
  }

  :host(:not(:last-of-type)) .label:active {
    color: color-mix(in oklab, currentColor, var(--wa-color-mix-active));
  }

  .label:focus {
    outline: none;
  }

  .label:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  .start,
  .end {
    display: none;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .start,
  .end {
    display: inline-flex;
    color: var(--wa-color-text-quiet);
  }

  ::slotted([slot='start']) {
    margin-inline-end: var(--wa-space-s);
  }

  ::slotted([slot='end']) {
    margin-inline-start: var(--wa-space-s);
  }

  :host(:last-of-type) .separator {
    display: none;
  }

  .separator {
    color: var(--wa-color-text-quiet);
    display: inline-flex;
    align-items: center;
    margin: 0 var(--wa-space-s);
    user-select: none;
    -webkit-user-select: none;
  }
`;var M=t=>t??lt;var Re=class extends E{constructor(){super(...arguments),this.renderType="button",this.rel="noreferrer noopener"}setRenderType(){let t=this.defaultSlot.assignedElements({flatten:!0}).filter(e=>e.tagName.toLowerCase()==="wa-dropdown").length>0;if(typeof this.href=="string"){this.renderType="link";return}if(t){this.renderType="dropdown";return}this.renderType="button"}hrefChanged(){this.setRenderType()}handleSlotChange(){this.setRenderType()}render(){return p`
      <span part="start" class="start">
        <slot name="start"></slot>
      </span>

      ${this.renderType==="link"?p`
            <a
              part="label"
              class="label label-link"
              href="${this.href}"
              target="${M(this.target?this.target:void 0)}"
              rel=${M(this.target?this.rel:void 0)}
            >
              <slot></slot>
            </a>
          `:""}
      ${this.renderType==="button"?p`
            <button part="label" type="button" class="label label-button">
              <slot @slotchange=${this.handleSlotChange}></slot>
            </button>
          `:""}
      ${this.renderType==="dropdown"?p`
            <div part="label" class="label label-dropdown">
              <slot @slotchange=${this.handleSlotChange}></slot>
            </div>
          `:""}

      <span part="end" class="end">
        <slot name="end"></slot>
      </span>

      <span part="separator" class="separator" aria-hidden="true">
        <slot name="separator"></slot>
      </span>
    `}};Re.css=fn;a([S("slot:not([name])")],Re.prototype,"defaultSlot",2);a([A()],Re.prototype,"renderType",2);a([l()],Re.prototype,"href",2);a([l()],Re.prototype,"target",2);a([l()],Re.prototype,"rel",2);a([y("href",{waitUntilFirstUpdate:!0})],Re.prototype,"hrefChanged",1);Re=a([k("wa-breadcrumb-item")],Re);var jt=()=>({checkValidity(t){let e=t.input,o={message:"",isValid:!0,invalidKeys:[]};if(!e)return o;let i=!0;if("checkValidity"in e&&(i=e.checkValidity()),i)return o;if(o.isValid=!1,"validationMessage"in e&&(o.message=e.validationMessage),!("validity"in e))return o.invalidKeys.push("customError"),o;for(let r in e.validity){if(r==="valid")continue;let s=r;e.validity[s]&&o.invalidKeys.push(s)}return o}});var Ko=class extends Event{constructor(){super("wa-invalid",{bubbles:!0,cancelable:!1,composed:!0})}};var Mp=()=>({observedAttributes:["custom-error"],checkValidity(t){let e={message:"",isValid:!0,invalidKeys:[]};return t.customError&&(e.message=t.customError,e.isValid=!1,e.invalidKeys=["customError"]),e}}),q=class extends E{constructor(){super(),this.name=null,this.disabled=!1,this.required=!1,this.assumeInteractionOn=["input"],this.validators=[],this.valueHasChanged=!1,this.hasInteracted=!1,this.customError=null,this.emittedEvents=[],this.emitInvalid=t=>{t.target===this&&(this.hasInteracted=!0,this.dispatchEvent(new Ko))},this.handleInteraction=t=>{let e=this.emittedEvents;e.includes(t.type)||e.push(t.type),e.length===this.assumeInteractionOn?.length&&(this.hasInteracted=!0)},"addEventListener"in this&&this.addEventListener("invalid",this.emitInvalid)}static get validators(){return[Mp()]}static get observedAttributes(){let t=new Set(super.observedAttributes||[]);for(let e of this.validators)if(e.observedAttributes)for(let o of e.observedAttributes)t.add(o);return[...t]}connectedCallback(){super.connectedCallback(),this.didSSR&&!this.hasUpdated?this.updateComplete.then(()=>{this.updateValidity()}):this.updateValidity(),this.assumeInteractionOn.forEach(t=>{this.addEventListener?.(t,this.handleInteraction)})}firstUpdated(...t){super.firstUpdated(...t),this.updateValidity()}willUpdate(t){if(!!1&&t.has("customError")&&(this.customError||(this.customError=null),this.setCustomValidity(this.customError||"")),t.has("value")||t.has("disabled")||t.has("defaultValue")){let e=this.value;this.updateFormValue(e)}t.has("disabled")&&(this.customStates.set("disabled",this.disabled),(this.hasAttribute("disabled")||!!1&&!this.matches(":disabled"))&&this.toggleAttribute("disabled",this.disabled)),super.willUpdate(t),this.didSSR&&!this.hasUpdated?this.updateComplete.then(()=>this.updateValidity()):this.updateValidity()}updateFormValue(t){if(Array.isArray(t)){if(this.name){let e=new FormData;for(let o of t)e.append(this.name,o);this.setValue(e,e)}}else this.setValue(t,t)}get labels(){return this.internals.labels}getForm(){return this.internals.form}set form(t){t?this.setAttribute("form",t):this.removeAttribute("form")}get form(){return this.internals.form}get validity(){return this.internals.validity}get willValidate(){return this.internals.willValidate}get validationMessage(){return this.internals.validationMessage}checkValidity(){return this.updateValidity(),this.internals.checkValidity()}reportValidity(){return this.updateValidity(),this.hasInteracted=!0,this.internals.reportValidity()}get validationTarget(){return this.input||void 0}setValidity(...t){let e=t[0],o=t[1],i=t[2];i||(i=this.validationTarget),this.internals.setValidity(e,o,i||void 0),this.requestUpdate("validity"),this.setCustomStates()}setCustomStates(){let t=!!this.required,e=this.internals.validity.valid,o=this.hasInteracted;this.customStates.set("required",t),this.customStates.set("optional",!t),this.customStates.set("invalid",!e),this.customStates.set("valid",e),this.customStates.set("user-invalid",!e&&o),this.customStates.set("user-valid",e&&o)}setCustomValidity(t){if(!t){this.customError=null,this.setValidity({});return}this.customError=t,this.setValidity({customError:!0},t,this.validationTarget)}formResetCallback(){this.resetValidity(),this.hasInteracted=!1,this.valueHasChanged=!1,this.emittedEvents=[],this.updateValidity()}formDisabledCallback(t){this.disabled=t,this.updateValidity()}formStateRestoreCallback(t,e){this.didSSR&&!this.hasUpdated?this.updateComplete.then(()=>{this.value=t,e==="restore"&&this.resetValidity(),this.updateValidity()}):(this.value=t,e==="restore"&&this.resetValidity(),this.updateValidity())}setValue(...t){let[e,o]=t;this.internals.setFormValue(e,o)}get allValidators(){let t=this.constructor.validators||[],e=this.validators||[];return[...t,...e]}resetValidity(){this.setCustomValidity(""),this.setValidity({})}updateValidity(){if(this.disabled||this.hasAttribute("disabled")||!this.willValidate){this.resetValidity();return}let t=this.allValidators;if(!t?.length)return;let e={customError:!!this.customError},o=this.validationTarget||this.input||void 0,i="";for(let r of t){let{isValid:s,message:n,invalidKeys:c}=r.checkValidity(this);s||(i||(i=n),c?.length>=0&&c.forEach(h=>e[h]=!0))}i||(i=this.validationMessage),this.setValidity(e,i,o)}};q.formAssociated=!0;a([l({reflect:!0})],q.prototype,"name",2);a([l({type:Boolean})],q.prototype,"disabled",2);a([l({state:!0,attribute:!1})],q.prototype,"valueHasChanged",2);a([l({state:!0,attribute:!1})],q.prototype,"hasInteracted",2);a([l({attribute:"custom-error",reflect:!0})],q.prototype,"customError",2);a([l({attribute:!1,state:!0,type:Object})],q.prototype,"validity",1);var Z=class{constructor(t,...e){this.slotNames=[],this.handleSlotChange=o=>{let i=o.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=t).addController(this),this.slotNames=e}hasDefaultSlot(){return this.host.childNodes?[...this.host.childNodes].some(t=>{if(t.nodeType===Node.TEXT_NODE&&t.textContent.trim()!=="")return!0;if(t.nodeType===Node.ELEMENT_NODE){let e=t;if(e.tagName.toLowerCase()==="wa-visually-hidden")return!1;if(!e.hasAttribute("slot"))return!0}return!1}):!1}hasNamedSlot(t){return this.host.querySelector?.(`:scope > [slot="${t}"]`)!==null}test(t,e){return e&&this.host.didSSR&&!this.host.hasUpdated?!!this.host[e]:t==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(t)}hostConnected(){let t=this.host.shadowRoot;t&&"addEventListener"in t&&t.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){let t=this.host.shadowRoot;t&&"removeEventListener"in t&&t.removeEventListener("slotchange",this.handleSlotChange)}};var gn=C`
  @layer wa-component {
    :host {
      display: inline-block;

      /* Workaround because Chrome doesn't like :host(:has()) below
       * https://issues.chromium.org/issues/40062355
       * Firefox doesn't like this nested rule, so both are needed */
      &:has(wa-badge) {
        position: relative;
      }
    }

    /* Apply relative positioning only when needed to position wa-badge
     * This avoids creating a new stacking context for every button */
    :host(:has(wa-badge)) {
      position: relative;
    }
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    transition-property: background, border, box-shadow, color, opacity, transform;
    transition-duration: var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    transform-origin: center;
    cursor: pointer;
    padding: 0 var(--wa-form-control-padding-inline);
    font-family: inherit;
    font-size: inherit;
    font-weight: var(--wa-font-weight-action);
    height: var(--wa-form-control-height);
    width: 100%;

    background-color: var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud));

    border-color: transparent;
    color: var(--wa-color-on-loud, var(--wa-color-neutral-on-loud));
    border-start-start-radius: var(--_button-start-start-radius, var(--wa-form-control-border-radius));
    border-start-end-radius: var(--_button-start-end-radius, var(--wa-form-control-border-radius));
    border-end-start-radius: var(--_button-end-start-radius, var(--wa-form-control-border-radius));
    border-end-end-radius: var(--_button-end-end-radius, var(--wa-form-control-border-radius));
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
  }

  /* Hover and active transforms */
  .button:not(.disabled):not(.loading) {
    @media (hover: hover) {
      &:hover {
        transform: var(--wa-button-transform-hover);
      }
    }
    &:active {
      transform: var(--wa-button-transform-active);
    }

    @media (prefers-reduced-motion: reduce) {
      &:hover,
      &:active {
        transform: none;
      }
    }
  }

  /* Appearance modifiers */
  :host([appearance='plain']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: transparent;
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
        background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='outlined']) {
    /* Indentation overrides for grouping outlined */
    margin-inline-start: var(--_button-horizontal-indent-outlined);
    margin-block-start: var(--_button-vertical-indent-outlined);

    .button {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: transparent;
      border-color: var(--wa-color-border-loud, var(--wa-color-neutral-border-loud));
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
        background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='filled']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal));
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='filled-outlined']) {
    /* Indentation overrides for grouping outlined */
    margin-inline-start: var(--_button-horizontal-indent-outlined);
    margin-block-start: var(--_button-vertical-indent-outlined);

    .button {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal));
      border-color: var(--wa-color-border-normal, var(--wa-color-neutral-border-normal));
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      color: var(--wa-color-on-normal, var(--wa-color-neutral-on-normal));
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-normal, var(--wa-color-neutral-fill-normal)),
        var(--wa-color-mix-active)
      );
    }
  }

  :host([appearance='accent']) {
    /* Indentation overrides for grouping */
    margin-inline-start: var(--_button-horizontal-indent);
    margin-block-start: var(--_button-vertical-indent);

    .button {
      color: var(--wa-color-on-loud, var(--wa-color-neutral-on-loud));
      background-color: var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud));
      border-color: transparent;
    }
    @media (hover: hover) {
      .button:not(.disabled):not(.loading):hover {
        background-color: color-mix(
          in oklab,
          var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud)),
          var(--wa-color-mix-hover)
        );
      }
    }
    .button:not(.disabled):not(.loading):active {
      background-color: color-mix(
        in oklab,
        var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud)),
        var(--wa-color-mix-active)
      );
    }
  }

  /* Focus states */
  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Disabled state */
  :host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;

    /* When disabled, prevent mouse events from bubbling up from children */
    .button {
      pointer-events: none;
    }
  }

  /* Keep it last so Safari doesn't stop parsing this block */
  .button::-moz-focus-inner {
    border: 0;
  }

  /* Icon buttons */
  .button.is-icon-button {
    outline-offset: 2px;
    width: var(--wa-form-control-height);
    aspect-ratio: 1;
  }

  /* Icon buttons with a caret need to grow to fit both the icon and the caret */
  .button.is-icon-button.caret {
    width: auto;
    aspect-ratio: auto;
    min-width: var(--wa-form-control-height);
  }

  /* Pill modifier */
  :host([pill]) .button {
    border-start-start-radius: var(--_button-start-start-radius, var(--wa-border-radius-pill));
    border-start-end-radius: var(--_button-start-end-radius, var(--wa-border-radius-pill));
    border-end-start-radius: var(--_button-end-start-radius, var(--wa-border-radius-pill));
    border-end-end-radius: var(--_button-end-end-radius, var(--wa-border-radius-pill));
  }

  /*
   * Label
   */

  .start,
  .end {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .label {
    display: inline-block;
  }

  .is-icon-button .label {
    display: flex;
    justify-content: center;
  }

  .label::slotted(wa-icon) {
    align-self: center;
  }

  /*
   * Caret modifier
   */

  wa-icon[part='caret'] {
    display: flex;
    align-self: center;
    align-items: center;

    &::part(svg) {
      width: 0.875em;
      height: 0.875em;
    }

    .button:has(&) .end {
      display: none;
    }
  }

  /*
   * Loading modifier
   */

  .loading {
    position: relative;
    cursor: wait;

    .start,
    .label,
    .end,
    .caret {
      visibility: hidden;
    }

    wa-spinner {
      --indicator-color: currentColor;
      --track-color: color-mix(in oklab, currentColor, transparent 90%);

      position: absolute;
      font-size: 1em;
      height: 1em;
      width: 1em;
      top: calc(50% - 0.5em);
      left: calc(50% - 0.5em);
    }
  }

  /*
   * Badges
   */

  .button ::slotted(wa-badge) {
    border-color: var(--wa-color-surface-default);
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  :host(:dir(rtl)) ::slotted(wa-badge) {
    translate: -50% -50%;
  }

  /*
  * Button spacing
  */

  slot[name='start']::slotted(*) {
    margin-inline-end: 0.75em;
  }

  slot[name='end']::slotted(*),
  .button:not(.visually-hidden-label) [part='caret'] {
    margin-inline-start: 0.75em;
  }
`;var bn={small:"s",medium:"m",large:"l"},vn=new Set;function U(t,e){e in bn&&!vn.has(`${t}:${e}`)&&(vn.add(`${t}:${e}`),console.warn(`[${t}] size="${e}" is deprecated. Use size="${bn[e]}" instead. The long-form value will be removed in the next major version.`))}var j=C`
  :host([size='xs']) {
    font-size: var(--wa-font-size-xs);
  }

  :host([size='s']),
  :host([size='small']) {
    font-size: var(--wa-font-size-s);
  }

  :host([size='m']),
  :host([size='medium']) {
    font-size: var(--wa-font-size-m);
  }

  :host([size='l']),
  :host([size='large']) {
    font-size: var(--wa-font-size-l);
  }

  :host([size='xl']) {
    font-size: var(--wa-font-size-xl);
  }
`;var yn=Symbol.for(""),Ip=t=>{if(t?.r===yn)return t?._$litStatic$};var da=(t,...e)=>({_$litStatic$:e.reduce((o,i,r)=>o+(s=>{if(s._$litStatic$!==void 0)return s._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${s}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+t[r+1],t[0]),r:yn}),wn=new Map,pa=t=>(e,...o)=>{let i=o.length,r,s,n=[],c=[],h,d=0,u=!1;for(;d<i;){for(h=e[d];d<i&&(s=o[d],(r=Ip(s))!==void 0);)h+=r+e[++d],u=!0;d!==i&&c.push(s),n.push(h),d++}if(d===i&&n.push(e[i]),u){let b=n.join("$$lit$$");(e=wn.get(b))===void 0&&(n.raw=n,wn.set(b,e=n)),o=c}return t(e,...o)},ir=pa(p),ay=pa(Ss),sy=pa(zs);var et=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["click"],this.hasSlotController=new Z(this,"[default]","start","end"),this.localize=new I(this),this.invalid=!1,this.isIconButton=!1,this.title="",this.variant="neutral",this.appearance="accent",this.size="m",this.withCaret=!1,this.withStart=!1,this.withEnd=!1,this.disabled=!1,this.loading=!1,this.pill=!1,this.type="button"}static get validators(){return[...super.validators,jt()]}handleSizeChange(){U(this.localName,this.size)}constructLightDOMButton(){let t=document.createElement("button");for(let e of this.attributes)e.name!=="style"&&t.setAttribute(e.name,e.value);return t.type=this.type,t.style.position="absolute !important",t.style.width="0 !important",t.style.height="0 !important",t.style.clipPath="inset(50%) !important",t.style.overflow="hidden !important",t.style.whiteSpace="nowrap !important",this.name&&(t.name=this.name),t.value=this.value||"",t}handleClick(t){if(this.disabled||this.loading){t.preventDefault(),t.stopImmediatePropagation();return}if(this.type!=="submit"&&this.type!=="reset"||!this.getForm())return;let o=this.constructLightDOMButton();this.parentElement?.append(o),o.click(),o.remove()}handleInvalid(){this.dispatchEvent(new Ko)}handleLabelSlotChange(){let t=this.labelSlot.assignedNodes({flatten:!0}),e=!1,o=!1,i=!1,r=!1;[...t].forEach(s=>{if(s.nodeType===Node.ELEMENT_NODE){let n=s;n.localName==="wa-icon"?(o=!0,e||(e=n.label!==void 0)):r=!0}else s.nodeType===Node.TEXT_NODE&&(s.textContent?.trim()||"").length>0&&(i=!0)}),this.isIconButton=o&&!i&&!r,this.customStates.set("icon-button",this.isIconButton),this.isIconButton&&!e&&console.warn('Icon buttons must have a label for screen readers. Add <wa-icon label="..."> to remove this warning.',this)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.customStates.set("disabled",this.disabled),this.updateValidity()}handleHrefChange(){this.customStates.set("link",this.isLink())}handleLoadingChange(){this.customStates.set("loading",this.loading)}setValue(...t){}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}render(){let t=this.isLink(),e=t?da`a`:da`button`;return ir`
      <${e}
        part="base button"
        class=${_({button:!0,caret:this.withCaret,disabled:this.disabled,loading:this.loading,rtl:this.localize.dir()==="rtl","has-label":this.hasSlotController.test("[default]"),"has-start":this.hasSlotController.test("start","withStart"),"has-end":this.hasSlotController.test("end","withEnd"),"is-icon-button":this.isIconButton})}
        ?disabled=${M(t?void 0:this.disabled)}
        type=${M(t?void 0:this.type)}
        title=${this.title}
        name=${M(t?void 0:this.name)}
        value=${M(t?void 0:this.value)}
        href=${M(t?this.href:void 0)}
        target=${M(t?this.target:void 0)}
        download=${M(t?this.download:void 0)}
        rel=${M(t&&this.rel?this.rel:void 0)}
        role=${M(t?void 0:"button")}
        aria-disabled=${M(t&&this.disabled?"true":void 0)}
        tabindex=${this.disabled?"-1":"0"}
        @invalid=${this.isButton()?this.handleInvalid:null}
        @click=${this.handleClick}
      >
        <slot name="start" part="start" class="start"></slot>
        <slot part="label" class="label" @slotchange=${this.handleLabelSlotChange}></slot>
        <slot name="end" part="end" class="end"></slot>
        ${this.withCaret?ir`
                <wa-icon part="caret" class="caret" library="system" name="chevron-down" variant="solid"></wa-icon>
              `:""}
        ${this.loading?ir`<wa-spinner part="spinner"></wa-spinner>`:""}
      </${e}>
    `}};et.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};et.css=[gn,De,j];a([S(".button")],et.prototype,"button",2);a([S("slot:not([name])")],et.prototype,"labelSlot",2);a([A()],et.prototype,"invalid",2);a([A()],et.prototype,"isIconButton",2);a([l()],et.prototype,"title",2);a([l({reflect:!0})],et.prototype,"variant",2);a([l({reflect:!0})],et.prototype,"appearance",2);a([l({reflect:!0})],et.prototype,"size",2);a([y("size")],et.prototype,"handleSizeChange",1);a([l({attribute:"with-caret",type:Boolean,reflect:!0})],et.prototype,"withCaret",2);a([l({attribute:"with-start",type:Boolean})],et.prototype,"withStart",2);a([l({attribute:"with-end",type:Boolean})],et.prototype,"withEnd",2);a([l({type:Boolean})],et.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],et.prototype,"loading",2);a([l({type:Boolean,reflect:!0})],et.prototype,"pill",2);a([l()],et.prototype,"type",2);a([l({reflect:!0})],et.prototype,"name",2);a([l({reflect:!0})],et.prototype,"value",2);a([l({reflect:!0})],et.prototype,"href",2);a([l()],et.prototype,"target",2);a([l()],et.prototype,"rel",2);a([l()],et.prototype,"download",2);a([l({attribute:"formaction"})],et.prototype,"formAction",2);a([l({attribute:"formenctype"})],et.prototype,"formEnctype",2);a([l({attribute:"formmethod"})],et.prototype,"formMethod",2);a([l({attribute:"formnovalidate",type:Boolean})],et.prototype,"formNoValidate",2);a([l({attribute:"formtarget"})],et.prototype,"formTarget",2);a([y("disabled",{waitUntilFirstUpdate:!0})],et.prototype,"handleDisabledChange",1);a([y("href")],et.prototype,"handleHrefChange",1);a([y("loading",{waitUntilFirstUpdate:!0})],et.prototype,"handleLoadingChange",1);et=a([k("wa-button")],et);et.disableWarning?.("change-in-update");var xn=C`
  :host {
    --track-width: 2px;
    --track-color: var(--wa-color-neutral-fill-normal);
    --indicator-color: var(--wa-color-brand-fill-loud);
    --speed: 2s;
    --size: 1em;

    /*
      Resizing a spinner element using anything but font-size will break the animation because the animation uses em
      units. Therefore, if a spinner is used in a flex container without \`flex: none\` applied, the spinner can
      grow/shrink and break the animation. The use of \`flex: none\` on the host element prevents this by always having
      the spinner sized according to its actual dimensions.
    */
    flex: none;
    display: inline-flex;
    width: var(--size);
    height: var(--size);
  }

  svg {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    animation: spin var(--speed) linear infinite;
  }

  .track,
  .indicator {
    --radius: calc(var(--size) / 2 - var(--track-width) / 2);
    --circumference: calc(var(--radius) * 2 * 3.141592654);

    cx: calc(var(--size) / 2);
    cy: calc(var(--size) / 2);
    r: var(--radius);
    fill: none;
    stroke-width: var(--track-width);
  }

  .track {
    stroke: var(--track-color);
  }

  .indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: calc(0.597 * var(--circumference)), calc(0.796 * var(--circumference));
    stroke-dashoffset: calc(-0.04 * var(--circumference));
    animation: dash 1.5s ease-in-out infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: calc(0.008 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: calc(0.716 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: calc(-0.278 * var(--circumference));
    }
    100% {
      stroke-dasharray: calc(0.716 * var(--circumference)), calc(1.194 * var(--circumference));
      stroke-dashoffset: calc(-0.987 * var(--circumference));
    }
  }
`;var rr=class extends E{constructor(){super(...arguments),this.localize=new I(this)}render(){return p`
      <svg
        part="base spinner"
        role="progressbar"
        aria-label=${this.localize.term("loading")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle class="track" />
        <circle class="indicator" />
      </svg>
    `}};rr.css=xn;rr=a([k("wa-spinner")],rr);var Cn=C`
  :host {
    display: inline-flex;
  }

  .button-group {
    display: flex;
    position: relative;
    isolation: isolate;
    flex-wrap: wrap;

    @media (hover: hover) {
      > :hover,
      &::slotted(:hover) {
        z-index: 1;
      }
    }

    /* Focus and checked are always on top */
    > :focus,
    &::slotted(:focus),
    > [aria-checked='true'],
    &::slotted([aria-checked='true']),
    > [checked],
    &::slotted([checked]) {
      z-index: 2 !important;
    }

    :host([orientation='horizontal']) & {
      flex-direction: row;
    }

    :host([orientation='vertical']) & {
      flex-direction: column;
    }
  }

  /* Set custom properties to be inherited by slotted buttons */
  :host([orientation='horizontal']) {
    --_button-horizontal-indent: var(--wa-form-control-border-width);
    --_button-horizontal-indent-outlined: calc(var(--wa-form-control-border-width) * -1);

    ::slotted(:first-child) {
      --_button-horizontal-indent: 0;
      --_button-horizontal-indent-outlined: 0;
    }
  }

  :host([orientation='vertical']) {
    --_button-vertical-indent: var(--wa-form-control-border-width);
    --_button-vertical-indent-outlined: calc(var(--wa-form-control-border-width) * -1);

    ::slotted(:first-child) {
      --_button-vertical-indent: 0;
      --_button-vertical-indent-outlined: 0;
    }
  }

  /* All buttons that are not in front or at the end get their border radius removed */
  ::slotted(:not(:first-child):not(:last-child)) {
    --_button-start-start-radius: 0;
    --_button-start-end-radius: 0;
    --_button-end-start-radius: 0;
    --_button-end-end-radius: 0;
  }

  /* Remove leading and trailing buttons border radius individually */
  :host([orientation='horizontal']) {
    ::slotted(:first-child:not(:last-child)) {
      --_button-start-end-radius: 0;
      --_button-end-end-radius: 0;
    }

    ::slotted(:last-child:not(:first-child)) {
      --_button-start-start-radius: 0;
      --_button-end-start-radius: 0;
    }
  }

  :host([orientation='vertical']) {
    ::slotted(:first-child:not(:last-child)) {
      --_button-end-start-radius: 0;
      --_button-end-end-radius: 0;
    }

    ::slotted(:last-child:not(:first-child)) {
      --_button-start-start-radius: 0;
      --_button-start-end-radius: 0;
    }
  }
`;var Ye=class extends E{constructor(){super(...arguments),this.disableRole=!1,this.hasOutlined=!1,this.label="",this.orientation="horizontal"}updated(t){super.updated(t),t.has("orientation")&&this.setAttribute("aria-orientation",this.orientation)}handleFocus(t){ar(t.target)?.classList.add("button-focus")}handleBlur(t){ar(t.target)?.classList.remove("button-focus")}handleMouseOver(t){ar(t.target)?.classList.add("button-hover")}handleMouseOut(t){ar(t.target)?.classList.remove("button-hover")}render(){return p`
      <slot
        part="base"
        class="button-group"
        role="${this.disableRole?"presentation":"group"}"
        aria-label=${this.label}
        aria-orientation=${this.orientation}
        @focusout=${this.handleBlur}
        @focusin=${this.handleFocus}
        @mouseover=${this.handleMouseOver}
        @mouseout=${this.handleMouseOut}
      ></slot>
    `}};Ye.css=[Cn];a([S("slot")],Ye.prototype,"defaultSlot",2);a([A()],Ye.prototype,"disableRole",2);a([A()],Ye.prototype,"hasOutlined",2);a([l()],Ye.prototype,"label",2);a([l({reflect:!0})],Ye.prototype,"orientation",2);Ye=a([k("wa-button-group")],Ye);function ar(t){let e="wa-button, wa-radio-button";return t.closest(e)??t.querySelector(e)}var kn=C`
  :host {
    display: flex;
    position: relative;
    align-items: stretch;
    border-radius: var(--wa-panel-border-radius);
    background-color: var(--wa-color-fill-quiet, var(--wa-color-brand-fill-quiet));
    border-color: var(--wa-color-border-quiet, var(--wa-color-brand-border-quiet));
    border-style: var(--wa-panel-border-style);
    border-width: var(--wa-panel-border-width);
    color: var(--wa-color-text-normal);
    padding: 1em;
  }

  /* Appearance modifiers */
  :host([appearance~='plain']) {
    background-color: transparent;
    border-color: transparent;
  }

  :host([appearance~='outlined']) {
    background-color: transparent;
    border-color: var(--wa-color-border-loud, var(--wa-color-brand-border-loud));
  }

  :host([appearance~='filled']) {
    background-color: var(--wa-color-fill-quiet, var(--wa-color-brand-fill-quiet));
    border-color: transparent;
  }

  :host([appearance~='filled-outlined']) {
    border-color: var(--wa-color-border-quiet, var(--wa-color-brand-border-quiet));
  }

  :host([appearance~='accent']) {
    color: var(--wa-color-on-loud, var(--wa-color-brand-on-loud));
    background-color: var(--wa-color-fill-loud, var(--wa-color-brand-fill-loud));
    border-color: transparent;

    [part~='icon'] {
      color: currentColor;
    }
  }

  [part~='icon'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    color: var(--wa-color-on-quiet);
    font-size: 1.25em;
  }

  ::slotted([slot='icon']) {
    margin-inline-end: var(--wa-form-control-padding-inline);
  }

  [part~='message'] {
    flex: 1 1 auto;
    display: block;
    overflow: hidden;
  }
`;var ao=class extends E{constructor(){super(...arguments),this.variant="brand",this.size="m"}handleSizeChange(){U(this.localName,this.size)}render(){return p`
      <div part="icon">
        <slot name="icon"></slot>
      </div>

      <div part="message">
        <slot></slot>
      </div>
    `}};ao.css=[kn,De,j];a([l({reflect:!0})],ao.prototype,"variant",2);a([l({reflect:!0})],ao.prototype,"appearance",2);a([l({reflect:!0})],ao.prototype,"size",2);a([y("size")],ao.prototype,"handleSizeChange",1);ao=a([k("wa-callout")],ao);var Sn=C`
  :host {
    --spacing: var(--wa-space-l);

    /* Internal calculated properties */
    --inner-border-radius: calc(var(--wa-panel-border-radius) - var(--wa-panel-border-width));

    display: flex;
    flex-direction: column;
    background-color: var(--wa-color-surface-default);
    border-color: var(--wa-color-surface-border);
    border-radius: var(--wa-panel-border-radius);
    border-style: var(--wa-panel-border-style);
    box-shadow: var(--wa-shadow-s);
    border-width: var(--wa-panel-border-width);
    color: var(--wa-color-text-normal);
  }

  /* Appearance modifiers */
  :host([appearance='plain']) {
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  :host([appearance='outlined']) {
    background-color: var(--wa-color-surface-default);
    border-color: var(--wa-color-surface-border);
  }

  :host([appearance='filled']) {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: transparent;
  }

  :host([appearance='filled-outlined']) {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-surface-border);
  }

  :host([appearance='accent']) {
    color: var(--wa-color-neutral-on-loud);
    background-color: var(--wa-color-neutral-fill-loud);
    border-color: transparent;
  }

  /* Take care of top and bottom radii */
  .media,
  :host(:not([with-media])) .header,
  :host(:not([with-media], [with-header])) .body {
    border-start-start-radius: var(--inner-border-radius);
    border-start-end-radius: var(--inner-border-radius);
  }

  :host(:not([with-footer])) .body,
  .footer {
    border-end-start-radius: var(--inner-border-radius);
    border-end-end-radius: var(--inner-border-radius);
  }

  .media {
    display: flex;
    overflow: hidden;

    &::slotted(*) {
      display: block;
      width: 100%;
      border-radius: 0 !important;
    }
  }

  /* Round all corners for plain appearance */
  :host([appearance='plain']) .media {
    border-radius: var(--inner-border-radius);

    &::slotted(*) {
      border-radius: inherit !important;
    }
  }

  .header {
    display: block;
    border-block-end-style: inherit;
    border-block-end-color: var(--wa-color-surface-border);
    border-block-end-width: var(--wa-panel-border-width);
    padding: calc(var(--spacing) / 2) var(--spacing);
  }

  .body {
    display: block;
    padding: var(--spacing);
  }

  .footer {
    display: block;
    border-block-start-style: inherit;
    border-block-start-color: var(--wa-color-surface-border);
    border-block-start-width: var(--wa-panel-border-width);
    padding: var(--spacing);
  }

  /* Push slots to sides when the action slots renders */
  .has-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  :host(:not([with-header])) .header,
  :host(:not([with-footer])) .footer,
  :host(:not([with-media])) .media {
    display: none;
  }

  /* Orientation Styles */
  :host([orientation='horizontal']) {
    flex-direction: row;

    .media {
      border-start-start-radius: var(--inner-border-radius);
      border-end-start-radius: var(--inner-border-radius);
      border-start-end-radius: 0;

      &::slotted(*) {
        block-size: 100%;
        inline-size: 100%;
        object-fit: cover;
      }
    }
  }

  :host([orientation='horizontal']) .body slot::slotted(*) {
    display: block;
    height: 100%;
    margin: 0;
  }

  :host([orientation='horizontal']) slot[name='actions']::slotted(*) {
    display: flex;
    align-items: center;
    padding: var(--spacing);
  }
`;var be=class extends E{constructor(){super(...arguments),this.hasSlotController=new Z(this,"footer","header","media","header-actions","footer-actions","actions"),this.appearance="outlined",this.withHeader=!1,this.withMedia=!1,this.withFooter=!1,this.withHeaderActions=!1,this.withFooterActions=!1,this.orientation="vertical"}willUpdate(t){this.withHeader=this.hasSlotController.test("header","withHeader"),this.withMedia=this.hasSlotController.test("media","withMedia"),this.withFooter=this.hasSlotController.test("footer","withFooter"),super.willUpdate(t)}render(){if(this.orientation==="horizontal")return p`
        <slot name="media" part="media" class="media"></slot>
        <div part="body" class="body"><slot></slot></div>
        <slot name="actions" part="actions" class="actions"></slot>
      `;let t=this.hasSlotController.test("header-actions","withHeaderActions"),e=this.hasSlotController.test("footer-actions","withFooterActions");return p`
      <slot name="media" part="media" class="media"></slot>

      <header
        part="header"
        class=${_({header:!0,"has-actions":t})}
      >
        <slot name="header"></slot>
        <slot name="header-actions"></slot>
      </header>

      <div part="body" class="body"><slot></slot></div>

      <footer
        part="footer"
        class=${_({footer:!0,"has-actions":e})}
      >
        <slot name="footer"></slot>
        <slot name="footer-actions"></slot>
      </footer>
    `}};be.css=[j,Sn];a([l({reflect:!0})],be.prototype,"appearance",2);a([l({attribute:"with-header",type:Boolean,reflect:!0})],be.prototype,"withHeader",2);a([l({attribute:"with-media",type:Boolean,reflect:!0})],be.prototype,"withMedia",2);a([l({attribute:"with-footer",type:Boolean,reflect:!0})],be.prototype,"withFooter",2);a([l({attribute:"with-header-actions",type:Boolean,reflect:!0})],be.prototype,"withHeaderActions",2);a([l({attribute:"with-footer-actions",type:Boolean,reflect:!0})],be.prototype,"withFooterActions",2);a([l({reflect:!0})],be.prototype,"orientation",2);be=a([k("wa-card")],be);be.disableWarning?.("change-in-update");var zn=class extends Event{constructor(t){super("wa-slide-change",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var En="useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";var Ln=(t=21)=>{let e="",o=crypto.getRandomValues(new Uint8Array(t|=0));for(;t--;)e+=En[o[t]&63];return e};function W(t,e,o){let i=r=>Object.is(r,-0)?0:r;return t<e?i(e):t>o?i(o):i(t)}function ee(t=""){return`${t}${Ln()}`}var sr=class{constructor(t,e){this.timerId=0,this.activeInteractions=0,this.paused=!1,this.stopped=!0,this.pause=()=>{this.activeInteractions++||(this.paused=!0,this.host.requestUpdate())},this.resume=()=>{--this.activeInteractions||(this.paused=!1,this.host.requestUpdate())},t.addController(this),this.host=t,this.tickCallback=e}hostConnected(){this.host.addEventListener("mouseenter",this.pause),this.host.addEventListener("mouseleave",this.resume),this.host.addEventListener("focusin",this.pause),this.host.addEventListener("focusout",this.resume),this.host.addEventListener("touchstart",this.pause,{passive:!0}),this.host.addEventListener("touchend",this.resume)}hostDisconnected(){this.stop(),this.host.removeEventListener("mouseenter",this.pause),this.host.removeEventListener("mouseleave",this.resume),this.host.removeEventListener("focusin",this.pause),this.host.removeEventListener("focusout",this.resume),this.host.removeEventListener("touchstart",this.pause),this.host.removeEventListener("touchend",this.resume)}start(t){this.stop(),this.stopped=!1,this.timerId=window.setInterval(()=>{this.paused||this.tickCallback()},t)}stop(){clearInterval(this.timerId),this.stopped=!0,this.host.requestUpdate()}};var $n=C`
  :host {
    --aspect-ratio: 16 / 9;
    --scroll-hint: 0px;
    --slide-gap: var(--wa-space-m, 1rem); /* fallback value is necessary */

    display: flex;
  }

  .carousel {
    display: grid;
    grid-template-columns: min-content 1fr min-content;
    grid-template-rows: 1fr min-content;
    grid-template-areas:
      '. slides .'
      '. pagination .';
    gap: var(--wa-space-m);
    align-items: center;
    min-height: 100%;
    min-width: 100%;
    position: relative;
  }

  .pagination {
    grid-area: pagination;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--wa-space-s);
    padding-block: var(--wa-space-3xs);
  }

  .slides {
    grid-area: slides;

    display: grid;
    height: 100%;
    width: 100%;
    align-items: center;
    justify-items: center;
    overflow: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    aspect-ratio: calc(var(--aspect-ratio) * var(--slides-per-page));
    border-radius: var(--wa-border-radius-m);

    --slide-size: calc((100% - (var(--slides-per-page) - 1) * var(--slide-gap)) / var(--slides-per-page));
  }

  /*
   * While a looping carousel that initialized inside a hidden container waits to scroll past its leading clones, hide
   * the slides and pagination to avoid flashing the wrong slide and active dot, then fade them in once the carousel has
   * positioned itself.
   */
  .slides,
  .pagination {
    transition: opacity var(--wa-transition-fast) ease;
  }

  .slides-awaiting-position,
  .pagination-awaiting-position {
    opacity: 0;
    transition: none;
  }

  @media (prefers-reduced-motion) {
    :where(.slides) {
      scroll-behavior: auto;
    }
  }

  .slides-horizontal {
    grid-auto-flow: column;
    grid-auto-columns: var(--slide-size);
    grid-auto-rows: 100%;
    column-gap: var(--slide-gap);
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--scroll-hint);
    padding-inline: var(--scroll-hint);
    overflow-y: hidden;
  }

  .slides-vertical {
    grid-auto-flow: row;
    grid-auto-columns: 100%;
    grid-auto-rows: var(--slide-size);
    row-gap: var(--slide-gap);
    scroll-snap-type: y mandatory;
    scroll-padding-block: var(--scroll-hint);
    padding-block: var(--scroll-hint);
    overflow-x: hidden;
  }

  :host([vertical]) ::slotted(wa-carousel-item) {
    height: 100%;
  }

  .slides::-webkit-scrollbar {
    display: none;
  }

  .navigation {
    grid-area: navigation;
    display: contents;
    font-size: var(--wa-font-size-l);
  }

  .navigation-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--wa-border-radius-m);
    font-size: inherit;
    color: var(--wa-color-text-quiet);
    padding: var(--wa-space-xs);
    cursor: pointer;
    transition: var(--wa-transition-normal) color;
    appearance: none;
  }

  .navigation-button-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .navigation-button-disabled::part(base) {
    pointer-events: none;
  }

  .navigation-button-previous {
    grid-column: 1;
    grid-row: 1;
  }

  .navigation-button-next {
    grid-column: 3;
    grid-row: 1;
  }

  .pagination-item {
    display: block;
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: var(--wa-border-radius-circle);
    width: var(--wa-space-s);
    height: var(--wa-space-s);
    background-color: var(--wa-color-neutral-fill-normal);
    padding: 0;
    margin: 0;
    transition: transform var(--wa-transition-slow);
  }

  .pagination-item-active {
    background-color: var(--wa-form-control-activated-color);
    transform: scale(1.25);
  }

  /* Focus styles */
  .slides:focus-visible,
  .navigation-button:focus-visible,
  .pagination-item:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }
`;function*An(t,e){if(t!==void 0){let o=0;for(let i of t)yield e(i,o++)}}function*_n(t,e,o=1){let i=e===void 0?0:t;e??=t;for(let r=i;o>0?r<e:e<r;r+=o)yield r}(()=>{if(!1)return;let t=(i,r)=>{let s=0;return function(...n){window.clearTimeout(s),s=window.setTimeout(()=>{i.call(this,...n)},r)}},e=(i,r,s)=>{let n=i[r];i[r]=function(...c){n.call(this,...c),s.call(this,n,...c)}};if(!("onscrollend"in window)){let i=new Set,r=new WeakMap,s=c=>{i.add(c.pointerId)},n=c=>{i.delete(c.pointerId)};document.addEventListener("pointerdown",s),document.addEventListener("pointerup",n),e(EventTarget.prototype,"addEventListener",function(c,h){if(h!=="scroll")return;let d=t(()=>{i.size?d():this.dispatchEvent(new Event("scrollend"))},100);c.call(this,"scroll",d,{passive:!0}),r.set(this,d)}),e(EventTarget.prototype,"removeEventListener",function(c,h){if(h!=="scroll")return;let d=r.get(this);d&&c.call(this,"scroll",d,{passive:!0})})}})();var gt=class extends E{constructor(){super(...arguments),this.loop=!1,this.slides=0,this.currentSlide=0,this.navigation=!1,this.pagination=!1,this.autoplay=!1,this.autoplayInterval=3e3,this.slidesPerPage=1,this.slidesPerMove=1,this.orientation="horizontal",this.mouseDragging=!1,this.activeSlide=0,this.scrolling=!1,this.dragging=!1,this.awaitingInitialPosition=!1,this.autoplayController=new sr(this,()=>this.next()),this.dragStartPosition=[-1,-1],this.localize=new I(this),this.pendingSlideChange=!1,this.handleMouseDrag=t=>{this.dragging||(this.scrollContainer.style.setProperty("scroll-snap-type","none"),this.dragging=!0,this.dragStartPosition=[t.clientX,t.clientY]),this.scrollContainer.scrollBy({left:-t.movementX,top:-t.movementY,behavior:"instant"})},this.handleMouseDragEnd=()=>{let t=this.scrollContainer;document.removeEventListener("pointermove",this.handleMouseDrag,{capture:!0});let e=t.scrollLeft,o=t.scrollTop;t.style.removeProperty("scroll-snap-type"),t.style.setProperty("overflow","hidden");let i=t.scrollLeft,r=t.scrollTop;t.style.removeProperty("overflow"),t.style.setProperty("scroll-snap-type","none"),t.scrollTo({left:e,top:o,behavior:"instant"}),requestAnimationFrame(async()=>{(e!==i||o!==r)&&(t.scrollTo({left:i,top:r,behavior:$o()?"auto":"smooth"}),await Ct(t,"scrollend")),t.style.removeProperty("scroll-snap-type"),this.dragging=!1,this.dragStartPosition=[-1,-1],this.handleScrollEnd()})},this.handleSlotChange=t=>{t.some(o=>[...o.addedNodes,...o.removedNodes].some(i=>this.isCarouselItem(i)&&!i.hasAttribute("data-clone")))&&this.initializeSlides(),this.requestUpdate()}}connectedCallback(){super.connectedCallback(),this.setAttribute("role","region"),this.setAttribute("aria-label",this.localize.term("carousel"))}disconnectedCallback(){super.disconnectedCallback(),this.mutationObserver?.disconnect(),this.resizeObserver?.disconnect()}firstUpdated(){this.initializeSlides(),this.mutationObserver=new MutationObserver(this.handleSlotChange),this.mutationObserver.observe(this,{childList:!0,subtree:!0}),this.loop&&!this.scrollContainer?.clientWidth&&!this.scrollContainer?.clientHeight&&(this.awaitingInitialPosition=!0),this.resizeObserver=new ResizeObserver(()=>{(this.scrollContainer?.clientWidth||this.scrollContainer?.clientHeight)&&(this.goToSlide(this.activeSlide,"auto"),this.synchronizeSlides(),this.resizeObserver?.disconnect(),this.resizeObserver=void 0,this.awaitingInitialPosition&&requestAnimationFrame(()=>{requestAnimationFrame(()=>{this.awaitingInitialPosition=!1})}))}),this.resizeObserver.observe(this)}willUpdate(t){(t.has("slidesPerMove")||t.has("slidesPerPage"))&&(this.slidesPerMove=Math.min(this.slidesPerMove,this.slidesPerPage))}getPageCount(){let t=this.getSlides().length,{slidesPerPage:e,slidesPerMove:o,loop:i}=this,r=i?t/o:(t-e)/o+1;return Math.ceil(r)}getCurrentPage(){return Math.ceil(this.activeSlide/this.slidesPerMove)}canScrollNext(){return this.loop||this.getCurrentPage()<this.getPageCount()-1}canScrollPrev(){return this.loop||this.getCurrentPage()>0}getSlides({excludeClones:t=!0}={}){return[...this.children].filter(e=>this.isCarouselItem(e)&&(!t||!e.hasAttribute("data-clone")))}handleClick(t){if(this.dragging&&this.dragStartPosition[0]>0&&this.dragStartPosition[1]>0){let e=Math.abs(this.dragStartPosition[0]-t.clientX),o=Math.abs(this.dragStartPosition[1]-t.clientY);Math.sqrt(e*e+o*o)>=10&&t.preventDefault()}}handleKeyDown(t){if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key)){let e=t.target,o=this.localize.dir()==="rtl",i=e.closest('[part~="pagination-item"]')!==null,r=t.key==="ArrowDown"||!o&&t.key==="ArrowRight"||o&&t.key==="ArrowLeft",s=t.key==="ArrowUp"||!o&&t.key==="ArrowLeft"||o&&t.key==="ArrowRight";t.preventDefault(),s&&this.previous(),r&&this.next(),t.key==="Home"&&this.goToSlide(0),t.key==="End"&&this.goToSlide(this.getSlides().length-1),i&&this.updateComplete.then(()=>{let n=this.shadowRoot?.querySelector('[part~="pagination-item-active"]');n&&n.focus()})}}handleMouseDragStart(t){this.mouseDragging&&t.button===0&&(t.preventDefault(),document.addEventListener("pointermove",this.handleMouseDrag,{capture:!0,passive:!0}),document.addEventListener("pointerup",this.handleMouseDragEnd,{capture:!0,once:!0}))}handleScroll(){this.scrolling=!0,this.pendingSlideChange||this.synchronizeSlides()}synchronizeSlides(){let t=new IntersectionObserver(e=>{t.disconnect();for(let c of e){let h=c.target;h.toggleAttribute("inert",!c.isIntersecting),h.classList.toggle("--in-view",c.isIntersecting),h.setAttribute("aria-hidden",c.isIntersecting?"false":"true")}let o=e.find(c=>c.isIntersecting);if(!o)return;let i=this.getSlides({excludeClones:!1}),r=this.getSlides().length,s=i.indexOf(o.target),n=this.loop?s-this.slidesPerPage:s;if(o&&(this.activeSlide=(Math.ceil(n/this.slidesPerMove)*this.slidesPerMove+r)%r,!this.scrolling&&!this.pendingSlideChange&&this.loop&&o.target.hasAttribute("data-clone"))){let c=Number(o.target.getAttribute("data-clone"));this.goToSlide(c,"instant")}},{root:this.scrollContainer,threshold:.6});this.getSlides({excludeClones:!1}).forEach(e=>{t.observe(e)})}handleScrollEnd(){!this.scrolling||this.dragging||(this.synchronizeSlides(),this.scrolling=!1,this.pendingSlideChange=!1,this.synchronizeSlides())}isCarouselItem(t){return t instanceof Element&&t.tagName.toLowerCase()==="wa-carousel-item"}initializeSlides(){this.getSlides({excludeClones:!1}).forEach((t,e)=>{t.classList.remove("--in-view"),t.classList.remove("--is-active"),t.setAttribute("aria-label",this.localize.term("slideNum",e+1)),t.hasAttribute("data-clone")&&t.remove()}),this.updateSlidesSnap(),this.loop&&this.createClones(),this.goToSlide(this.activeSlide,"auto"),this.synchronizeSlides()}createClones(){let t=this.getSlides(),e=this.slidesPerPage,o=t.slice(-e),i=t.slice(0,e);o.reverse().forEach((r,s)=>{let n=r.cloneNode(!0);n.setAttribute("data-clone",String(t.length-s-1)),this.prepend(n)}),i.forEach((r,s)=>{let n=r.cloneNode(!0);n.setAttribute("data-clone",String(s)),this.append(n)})}handleSlideChange(){let t=this.getSlides();t.forEach((e,o)=>{e.classList.toggle("--is-active",o===this.activeSlide)}),this.hasUpdated&&this.dispatchEvent(new zn({index:this.activeSlide,slide:t[this.activeSlide]}))}updateSlidesSnap(){let t=this.getSlides(),e=this.slidesPerMove;t.forEach((o,i)=>{(i+e)%e===0?o.style.removeProperty("scroll-snap-align"):o.style.setProperty("scroll-snap-align","none")})}handleAutoplayChange(){this.autoplayController.stop(),this.autoplay&&this.autoplayController.start(this.autoplayInterval)}previous(t="smooth"){this.goToSlide(this.activeSlide-this.slidesPerMove,t)}next(t="smooth"){this.goToSlide(this.activeSlide+this.slidesPerMove,t)}addSlide(t){if(!this.isCarouselItem(t))throw new TypeError("addSlide() expects a <wa-carousel-item>.");if(t.hasAttribute("data-clone"))throw new TypeError("addSlide() cannot add a cloned carousel item.");let e=this.getSlides(),o=e[e.length-1];this.insertBefore(t,o?.nextElementSibling??null)}removeSlide(t){if(!Number.isInteger(t))return;let e=this.getSlides(),o=e[t];if(!o)return;let i=Math.max(0,e.length-2);t<this.activeSlide?this.activeSlide=Math.max(0,this.activeSlide-1):t===this.activeSlide&&(this.activeSlide=W(this.activeSlide,0,i)),o.remove()}goToSlide(t,e="smooth"){let{slidesPerPage:o,loop:i}=this,r=this.getSlides(),s=this.getSlides({excludeClones:!1});if(!r.length)return;let n=i?(t+r.length)%r.length:W(t,0,r.length-o);this.activeSlide=n;let c=this.localize.dir()==="rtl",h=W(t+(i?o:0)+(c?o-1:0),0,s.length-1),d=s[h];this.scrollToSlide(d,$o()?"auto":e)}scrollToSlide(t,e="smooth"){this.pendingSlideChange=!0,window.requestAnimationFrame(()=>{if(!this.scrollContainer)return;let o=this.scrollContainer,i=o.getBoundingClientRect(),r=t.getBoundingClientRect(),s=r.left-i.left,n=r.top-i.top;s||n?(this.pendingSlideChange=!0,o.scrollTo({left:s+o.scrollLeft,top:n+o.scrollTop,behavior:e})):this.pendingSlideChange=!1})}render(){let{slidesPerMove:t,scrolling:e}=this,o=0,i=0,r=!1,s=!1;this.hasUpdated&&(o=this.getPageCount(),i=this.getCurrentPage(),r=this.canScrollPrev(),s=this.canScrollNext());let n=this.localize.dir()==="rtl";return p`
      <div part="base carousel" class="carousel">
        <div
          id="scroll-container"
          part="scroll-container"
          class="${_({slides:!0,"slides-horizontal":this.orientation==="horizontal","slides-vertical":this.orientation==="vertical","slides-dragging":this.dragging,"slides-awaiting-position":this.awaitingInitialPosition})}"
          style=${ct({"--slides-per-page":this.slidesPerPage})}
          aria-busy="${e?"true":"false"}"
          aria-atomic="true"
          tabindex="0"
          @keydown=${this.handleKeyDown}
          @mousedown="${this.handleMouseDragStart}"
          @scroll="${this.handleScroll}"
          @scrollend=${this.handleScrollEnd}
          @click=${this.handleClick}
        >
          <slot @slotchange=${()=>this.requestUpdate()}></slot>
        </div>

        ${this.navigation?p`
              <div part="navigation" class="navigation">
                <button
                  part="navigation-button navigation-button-previous"
                  class="${_({"navigation-button":!0,"navigation-button-previous":!0,"navigation-button-disabled":!r})}"
                  aria-label="${this.localize.term("previousSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${r?"false":"true"}"
                  @click=${r?()=>this.previous():null}
                >
                  <slot name="previous-icon">
                    <wa-icon library="system" name="${n?"chevron-right":"chevron-left"}"></wa-icon>
                  </slot>
                </button>

                <button
                  part="navigation-button navigation-button-next"
                  class=${_({"navigation-button":!0,"navigation-button-next":!0,"navigation-button-disabled":!s})}
                  aria-label="${this.localize.term("nextSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${s?"false":"true"}"
                  @click=${s?()=>this.next():null}
                >
                  <slot name="next-icon">
                    <wa-icon library="system" name="${n?"chevron-left":"chevron-right"}"></wa-icon>
                  </slot>
                </button>
              </div>
            `:""}
        ${this.pagination?p`
              <div
                part="pagination"
                role="tablist"
                class="${_({pagination:!0,"pagination-awaiting-position":this.awaitingInitialPosition})}"
                aria-controls="scroll-container"
              >
                ${An(_n(o),c=>{let h=c===i;return p`
                    <button
                      part="pagination-item ${h?"pagination-item-active":""}"
                      class="${_({"pagination-item":!0,"pagination-item-active":h})}"
                      role="tab"
                      aria-selected="${h?"true":"false"}"
                      aria-label="${this.localize.term("goToSlide",c+1,o)}"
                      tabindex=${h?"0":"-1"}
                      @click=${()=>this.goToSlide(c*t)}
                      @keydown=${this.handleKeyDown}
                    ></button>
                  `})}
              </div>
            `:p``}
      </div>
    `}};gt.css=$n;a([l({type:Boolean,reflect:!0})],gt.prototype,"loop",2);a([l({type:Number,reflect:!0})],gt.prototype,"slides",2);a([l({type:Number,reflect:!0})],gt.prototype,"currentSlide",2);a([l({type:Boolean,reflect:!0})],gt.prototype,"navigation",2);a([l({type:Boolean,reflect:!0})],gt.prototype,"pagination",2);a([l({type:Boolean,reflect:!0})],gt.prototype,"autoplay",2);a([l({type:Number,attribute:"autoplay-interval"})],gt.prototype,"autoplayInterval",2);a([l({type:Number,attribute:"slides-per-page"})],gt.prototype,"slidesPerPage",2);a([l({type:Number,attribute:"slides-per-move"})],gt.prototype,"slidesPerMove",2);a([l()],gt.prototype,"orientation",2);a([l({type:Boolean,reflect:!0,attribute:"mouse-dragging"})],gt.prototype,"mouseDragging",2);a([S(".slides")],gt.prototype,"scrollContainer",2);a([S(".pagination")],gt.prototype,"paginationContainer",2);a([A()],gt.prototype,"activeSlide",2);a([A()],gt.prototype,"scrolling",2);a([A()],gt.prototype,"dragging",2);a([A()],gt.prototype,"awaitingInitialPosition",2);a([No({passive:!0})],gt.prototype,"handleScroll",1);a([y("loop",{waitUntilFirstUpdate:!0}),y("slidesPerPage",{waitUntilFirstUpdate:!0})],gt.prototype,"initializeSlides",1);a([y("activeSlide")],gt.prototype,"handleSlideChange",1);a([y("slidesPerMove")],gt.prototype,"updateSlidesSnap",1);a([y("autoplay")],gt.prototype,"handleAutoplayChange",1);gt=a([k("wa-carousel")],gt);var Tn=C`
  :host {
    --aspect-ratio: inherit;

    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    width: 100%;
    max-height: 100%;
    aspect-ratio: var(--aspect-ratio);
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  ::slotted(img) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
  }
`;var nr=class extends E{connectedCallback(){super.connectedCallback(),this.setAttribute("role","group")}render(){return p` <slot></slot> `}};nr.css=Tn;nr=a([k("wa-carousel-item")],nr);var Mn=C`
  :host {
    --checked-icon-color: var(--wa-color-brand-on-loud);
    --checked-icon-scale: 0.8;

    display: inline-flex;
    color: var(--wa-form-control-value-color);
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    user-select: none;
    -webkit-user-select: none;
  }

  [part~='control'] {
    display: inline-flex;
    flex: 0 0 auto;
    position: relative;
    align-items: center;
    justify-content: center;
    width: var(--wa-form-control-toggle-size);
    height: var(--wa-form-control-toggle-size);
    border-color: var(--wa-form-control-border-color);
    border-radius: min(
      calc(var(--wa-form-control-toggle-size) * 0.375),
      var(--wa-border-radius-s)
    ); /* min prevents entirely circular checkbox */
    border-style: var(--wa-border-style);
    border-width: var(--wa-form-control-border-width);
    background-color: var(--wa-form-control-background-color);
    transition:
      background var(--wa-transition-normal),
      border-color var(--wa-transition-fast),
      box-shadow var(--wa-transition-fast),
      color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);

    margin-inline-end: 0.5em;
  }

  [part~='base'] {
    display: flex;
    align-items: flex-start;
    position: relative;
    color: currentColor;
    vertical-align: middle;
    cursor: pointer;
  }

  [part~='label'] {
    display: inline;
  }

  /* Checked */
  [part~='control']:has(:checked, :indeterminate) {
    color: var(--checked-icon-color);
    border-color: var(--wa-form-control-activated-color);
    background-color: var(--wa-form-control-activated-color);
  }

  /* Focus */
  [part~='control']:has(> input:focus-visible:not(:disabled)) {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Disabled */
  :host [part~='base']:has(input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input {
    position: absolute;
    padding: 0;
    margin: 0;
    height: 100%;
    width: 100%;
    opacity: 0;
    pointer-events: none;
  }

  [part~='icon'] {
    display: flex;
    scale: var(--checked-icon-scale);

    /* Without this, Safari renders the icon slightly to the left */
    &::part(svg) {
      translate: 0.0009765625em;
    }

    input:not(:checked, :indeterminate) + & {
      visibility: hidden;
    }
  }

  :host([required]) [part~='label']::after {
    content: var(--wa-form-control-required-content);
    color: var(--wa-form-control-required-content-color);
    margin-inline-start: var(--wa-form-control-required-content-offset);
  }
`;var oe=(t={})=>{let{validationElement:e,validationProperty:o}=t;e||typeof document<"u"&&"createElement"in document&&(e=Object.assign(document.createElement("input"),{required:!0})),o||(o="value");let i={observedAttributes:["required"],message:e?.validationMessage,checkValidity(r){let s={message:"",isValid:!0,invalidKeys:[]};return(r.required??r.hasAttribute("required"))&&!r[o]&&(s.message=typeof i.message=="function"?i.message(r):i.message||"",s.isValid=!1,s.invalidKeys.push("valueMissing")),s}};return i};var pt=C`
  :host {
    display: flex;
    flex-direction: column;
  }

  /* Treat wrapped labels, inputs, and hints as direct children of the host element */
  [part~='form-control'] {
    display: contents;
  }

  /* Label */
  :is([part~='form-control-label'], [part~='label']):has(*:not(:empty)),
  :is([part~='form-control-label'], [part~='label']).has-label {
    display: inline-flex;
    color: var(--wa-form-control-label-color);
    font-weight: var(--wa-form-control-label-font-weight);
    line-height: var(--wa-form-control-label-line-height);
    margin-block-end: 0.5em;
  }

  :host([required]) :is([part~='form-control-label'], [part~='label'])::after {
    content: var(--wa-form-control-required-content);
    margin-inline-start: var(--wa-form-control-required-content-offset);
    color: var(--wa-form-control-required-content-color);
  }

  /* Help text */
  [part~='hint'] {
    display: block;
    color: var(--wa-form-control-hint-color);
    font-weight: var(--wa-form-control-hint-font-weight);
    line-height: var(--wa-form-control-hint-line-height);
    margin-block-start: 0.5em;
    font-size: var(--wa-font-size-smaller);

    &:not(.has-slotted, .has-hint) {
      display: none;
    }
  }
`;var Mt=io(class extends Me{constructor(t){if(super(t),t.type!==se.PROPERTY&&t.type!==se.ATTRIBUTE&&t.type!==se.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!an(t))throw Error("`live` bindings can only contain a single expression")}render(t){return t}update(t,[e]){if(e===Ot||e===lt)return e;let o=t.element,i=t.name;if(t.type===se.PROPERTY){if(e===o[i])return Ot}else if(t.type===se.BOOLEAN_ATTRIBUTE){if(!!e===o.hasAttribute(i))return Ot}else if(t.type===se.ATTRIBUTE&&o.getAttribute(i)===e+"")return Ot;return sn(t),e}});var At=class extends q{constructor(){super(...arguments),this.hasSlotController=new Z(this,"hint"),this.title="",this._value=this.getAttribute("value")??null,this.size="m",this.disabled=!1,this.indeterminate=!1,this._checked=null,this.defaultChecked=this.hasAttribute("checked"),this.required=!1,this.hint=""}static get validators(){let t=[oe({validationProperty:"checked",validationElement:Object.assign(document.createElement("input"),{type:"checkbox",required:!0})})];return[...super.validators,...t]}get value(){return this._value??"on"}set value(t){this._value=t}handleSizeChange(){U(this.localName,this.size)}get checked(){return this.valueHasChanged?!!this._checked:this._checked??this.defaultChecked}set checked(t){this._checked=!!t,this.valueHasChanged=!0}handleClick(){this.hasInteracted=!0,this.checked=!this.checked,this.indeterminate=!1,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}connectedCallback(){if(super.connectedCallback(),this.didSSR&&!this.hasUpdated){this.updateComplete.then(()=>{this.handleDefaultCheckedChange()});return}this.handleDefaultCheckedChange()}handleDefaultCheckedChange(){this.handleValueOrCheckedChange()}handleValueOrCheckedChange(){if(this.didSSR&&!this.hasUpdated){this.updateComplete.then(()=>{this.handleValueOrCheckedChange()});return}this.setValue(this.checked?this.value:null,this._value),this.updateValidity()}handleStateChange(){this.hasUpdated&&(this.input.checked=this.checked,this.input.indeterminate=this.indeterminate),this.customStates.set("checked",this.checked),this.customStates.set("indeterminate",this.indeterminate),this.updateValidity()}handleDisabledChange(){this.customStates.set("disabled",this.disabled)}willUpdate(t){super.willUpdate(t),(t.has("value")||t.has("checked")||t.has("defaultChecked")||t.has("disabled"))&&this.handleValueOrCheckedChange()}formResetCallback(){this._checked=null,super.formResetCallback(),this.handleValueOrCheckedChange()}click(){this.input.click()}focus(t){this.input.focus(t)}blur(){this.input.blur()}render(){let t=this.hasSlotController.test("hint"),e=this.hint?!0:!!t,o=!this.checked&&this.indeterminate,i=o?"indeterminate":"check",r=o?"indeterminate":"checked",s=this.didSSR&&!this.hasUpdated?this.checked:this.defaultChecked,n=this.didSSR&&!this.hasUpdated?null:Mt(this.checked);return p`
      <label part="base checkbox">
        <span part="control">
          <input
            class="input"
            type="checkbox"
            title=${this.title}
            name=${M(this.name)}
            value=${M(this.value)}
            .indeterminate=${Mt(this.indeterminate)}
            .checked=${M(n)}
            ?checked=${s}
            ?disabled=${this.disabled}
            ?required=${this.required}
            aria-checked=${this.indeterminate?"mixed":this.checked?"true":"false"}
            aria-describedby="hint"
            @click=${this.handleClick}
          />

          <wa-icon part="${r}-icon icon" library="system" name=${i}></wa-icon>
        </span>

        <slot part="label"></slot>
      </label>

      <slot
        id="hint"
        part="hint"
        name="hint"
        aria-hidden=${e?"false":"true"}
        class="${_({"has-slotted":e})}"
      >
        ${this.hint}
      </slot>
    `}};At.css=[pt,j,Mn];At.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S('input[type="checkbox"]')],At.prototype,"input",2);a([l()],At.prototype,"title",2);a([l({reflect:!0})],At.prototype,"value",1);a([l({reflect:!0})],At.prototype,"size",2);a([y("size")],At.prototype,"handleSizeChange",1);a([l({type:Boolean})],At.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],At.prototype,"indeterminate",2);a([l({type:Boolean,attribute:!1})],At.prototype,"checked",1);a([l({type:Boolean,reflect:!0,attribute:"checked"})],At.prototype,"defaultChecked",2);a([l({type:Boolean,reflect:!0})],At.prototype,"required",2);a([l()],At.prototype,"hint",2);a([y(["checked","defaultChecked"])],At.prototype,"handleDefaultCheckedChange",1);a([y(["checked","indeterminate"])],At.prototype,"handleStateChange",1);a([y("disabled")],At.prototype,"handleDisabledChange",1);At=a([k("wa-checkbox")],At);At.disableWarning?.("change-in-update");var In=C`
  :host {
    --gap: 0.5em;

    display: block;
  }

  :host([orientation='horizontal']) {
    --gap: 1em;
  }

  .form-control {
    position: relative;
    border: none;
    padding: 0;
    margin: 0;
  }

  .label {
    padding: 0;
  }

  .checkbox-group-required .label::after {
    content: var(--wa-form-control-required-content);
    margin-inline-start: var(--wa-form-control-required-content-offset);
  }

  /* The group of checkboxes */
  [part~='form-control-input'] {
    display: flex;
    flex-direction: column;
    /* Keep items sized to their content so the clickable label doesn't span the full width */
    align-items: start;
    gap: var(--gap);
    margin-block-start: 0.5em;
  }

  /* Horizontal */
  :host([orientation='horizontal']) [part~='form-control-input'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Hint */
  [part~='hint'] {
    margin-block-start: 0.5em;
  }

  /* Hide the required asterisk on individual controls; the group's label carries the indicator instead. */
  ::slotted(wa-checkbox[required]),
  ::slotted(wa-switch[required]) {
    --wa-form-control-required-content: '';
  }
`;var ne=class extends E{constructor(){super(...arguments),this.hasSlotController=new Z(this,"hint","label"),this.label="",this.hint="",this.orientation="vertical",this.required=!1,this.withLabel=!1,this.withHint=!1,this.syncCheckboxElements=()=>{if(this.size)for(let t of this.getAllCheckboxes())t.setAttribute("size",this.size)}}handleSizeChange(){U(this.localName,this.size)}updated(t){t.has("size")&&this.syncCheckboxElements()}getAllCheckboxes(){return[...this.querySelectorAll(":is(wa-checkbox, wa-switch)")]}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e;return p`
      <fieldset
        part="form-control"
        class=${_({"form-control":!0,"checkbox-group-required":this.required,"form-control-has-label":o})}
      >
        <label
          part="form-control-label"
          id="label"
          class=${_({label:!0,"has-label":o})}
          aria-hidden=${o?"false":"true"}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" role="group" aria-labelledby="label" aria-describedby="hint">
          <slot @slotchange=${this.syncCheckboxElements}></slot>
        </div>

        <slot
          id="hint"
          name="hint"
          part="hint"
          class=${_({"has-slotted":i})}
          aria-hidden=${i?"false":"true"}
          >${this.hint}</slot
        >
      </fieldset>
    `}};ne.css=[j,pt,In];a([l()],ne.prototype,"label",2);a([l({attribute:"hint"})],ne.prototype,"hint",2);a([l({reflect:!0})],ne.prototype,"orientation",2);a([l({reflect:!0})],ne.prototype,"size",2);a([y("size")],ne.prototype,"handleSizeChange",1);a([l({type:Boolean,reflect:!0})],ne.prototype,"required",2);a([l({type:Boolean,attribute:"with-label"})],ne.prototype,"withLabel",2);a([l({type:Boolean,attribute:"with-hint"})],ne.prototype,"withHint",2);ne=a([k("wa-checkbox-group")],ne);ne.disableWarning?.("change-in-update");function so(t,e){function o(r){let s=t.getBoundingClientRect(),n=t.ownerDocument.defaultView,c=s.left+n.pageXOffset,h=s.top+n.pageYOffset,d=r.pageX-c,u=r.pageY-h;e?.onMove&&e.onMove(d,u)}function i(){document.removeEventListener("pointermove",o),document.removeEventListener("pointerup",i),e?.onStop&&e.onStop()}document.addEventListener("pointermove",o,{passive:!0}),document.addEventListener("pointerup",i),e?.initialEvent instanceof PointerEvent&&o(e.initialEvent)}var ua=typeof window<"u"&&"ontouchstart"in window,fi=class{constructor(t,e){this.isActive=!1,this.isDragging=!1,this.handleDragStart=o=>{let i="touches"in o?o.touches[0].clientX:o.clientX,r="touches"in o?o.touches[0].clientY:o.clientY;this.isDragging||!ua&&o.buttons>1||(this.isDragging=!0,document.addEventListener("pointerup",this.handleDragStop),document.addEventListener("pointermove",this.handleDragMove),document.addEventListener("pointercancel",this.handleDragStop),document.addEventListener("touchend",this.handleDragStop),document.addEventListener("touchmove",this.handleDragMove),document.addEventListener("touchcancel",this.handleDragStop),this.options.start(i,r))},this.handleDragStop=o=>{let i="changedTouches"in o?o.changedTouches[0].clientX:o.clientX,r="changedTouches"in o?o.changedTouches[0].clientY:o.clientY;this.isDragging=!1,document.removeEventListener("pointerup",this.handleDragStop),document.removeEventListener("pointermove",this.handleDragMove),document.removeEventListener("pointercancel",this.handleDragStop),document.removeEventListener("touchend",this.handleDragStop),document.removeEventListener("touchmove",this.handleDragMove),document.removeEventListener("touchcancel",this.handleDragStop),this.options.stop(i,r)},this.handleDragMove=o=>{let i="touches"in o?o.touches[0].clientX:o.clientX,r="touches"in o?o.touches[0].clientY:o.clientY;window.getSelection()?.removeAllRanges(),this.options.move(i,r)},this.element=t,this.options={start:()=>{},stop:()=>{},move:()=>{},...e},this.start()}start(){this.isActive||(this.element.addEventListener("pointerdown",this.handleDragStart),ua&&this.element.addEventListener("touchstart",this.handleDragStart),this.isActive=!0)}stop(){document.removeEventListener("pointerup",this.handleDragStop),document.removeEventListener("pointermove",this.handleDragMove),document.removeEventListener("pointercancel",this.handleDragStop),document.removeEventListener("touchend",this.handleDragStop),document.removeEventListener("touchmove",this.handleDragMove),document.removeEventListener("touchcancel",this.handleDragStop),this.element.removeEventListener("pointerdown",this.handleDragStart),ua&&this.element.removeEventListener("touchstart",this.handleDragStart),this.isActive=!1,this.isDragging=!1}toggle(t){(t!==void 0?t:!this.isActive)?this.start():this.stop()}};var Pe=C`
  .wa-visually-hidden:not(:focus-within),
  .wa-visually-hidden-force,
  .wa-visually-hidden-hint::part(hint),
  .wa-visually-hidden-label::part(label),
  .wa-visually-hidden-label::part(form-control-label) {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    clip: rect(0 0 0 0) !important;
    clip-path: inset(50%) !important;
    border: none !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    padding: 0 !important;
  }
`;var To=[];function Kt(t){To.push(t)}function It(t){for(let e=To.length-1;e>=0;e--)if(To[e]===t){To.splice(e,1);break}}function Dt(t){return To.length>0&&To[To.length-1]===t}var Dn=C`
  :host {
    --grid-width: 17em;
    --grid-height: 12em;
    --grid-handle-size: 1.25em;
    --slider-height: 1em;
    --slider-handle-size: calc(var(--slider-height) + 0.25em);
  }

  .color-picker {
    background-color: var(--wa-color-surface-raised);
    border-radius: var(--wa-border-radius-m);
    border-style: var(--wa-border-style);
    border-width: var(--wa-border-width-s);
    border-color: var(--wa-color-surface-border);
    box-shadow: var(--wa-shadow-m);
    color: var(--color);
    font: inherit;
    font-size: inherit;
    user-select: none;
    width: var(--grid-width);
    -webkit-user-select: none;
  }

  .grid {
    position: relative;
    height: var(--grid-height);
    background-image:
      linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 100%),
      linear-gradient(to right, #fff 0%, rgba(255, 255, 255, 0) 100%);
    border-top-left-radius: calc(var(--wa-border-radius-m) - var(--wa-border-width-s));
    border-top-right-radius: calc(var(--wa-border-radius-m) - var(--wa-border-width-s));
    cursor: crosshair;
    forced-color-adjust: none;
  }

  .grid-handle {
    position: absolute;
    width: var(--grid-handle-size);
    height: var(--grid-handle-size);
    border-radius: var(--wa-border-radius-circle);
    box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.2);
    border: solid 0.125rem white;
    margin-top: calc(var(--grid-handle-size) / -2);
    margin-left: calc(var(--grid-handle-size) / -2);
    transition: scale var(--wa-transition-normal) var(--wa-transition-easing);
  }

  .grid-handle-dragging {
    cursor: none;
    scale: 1.5;
  }

  .grid-handle:focus-visible {
    outline: var(--wa-focus-ring);
  }

  .controls {
    padding: 0.75em;
    display: flex;
    align-items: center;
  }

  .sliders {
    flex: 1 1 auto;
  }

  .slider {
    position: relative;
    height: var(--slider-height);
    border-radius: var(--wa-border-radius-s);
    box-shadow: inset 0 0 0 0.0625rem rgba(0, 0, 0, 0.2);
    forced-color-adjust: none;
  }

  .slider:not(:last-of-type) {
    margin-bottom: 0.75em;
  }

  .slider-handle {
    position: absolute;
    top: calc(50% - var(--slider-handle-size) / 2);
    width: var(--slider-handle-size);
    height: var(--slider-handle-size);
    border-radius: var(--wa-border-radius-circle);
    border: solid 0.125rem white;
    box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.2);
    margin-left: calc(var(--slider-handle-size) / -2);
  }

  .slider-handle:focus-visible {
    outline: var(--wa-focus-ring);
  }

  .hue {
    background-image: linear-gradient(
      to right,
      rgb(255, 0, 0) 0%,
      rgb(255, 255, 0) 17%,
      rgb(0, 255, 0) 33%,
      rgb(0, 255, 255) 50%,
      rgb(0, 0, 255) 67%,
      rgb(255, 0, 255) 83%,
      rgb(255, 0, 0) 100%
    );
  }

  .alpha .alpha-gradient {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }

  .preview {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 3em;
    height: 3em;
    border: none;
    border-radius: var(--wa-border-radius-circle);
    background: none;
    font-size: inherit;
    margin-inline-start: 0.75em;
    cursor: copy;
    forced-color-adjust: none;
  }

  .preview:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    box-shadow: inset 0 0 0 0.0625rem rgba(0, 0, 0, 0.2);

    /* We use a custom property in lieu of currentColor because of https://bugs.webkit.org/show_bug.cgi?id=216780 */
    background-color: var(--preview-color);
  }

  .preview:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  .preview-color {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: solid 0.0625rem rgba(0, 0, 0, 0.125);
  }

  .preview-color-copied {
    animation: pulse 850ms;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 var(--wa-color-brand-fill-loud);
    }
    70% {
      box-shadow: 0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  .user-input {
    display: flex;
    align-items: center;
    padding: 0 0.75em 0.75em 0.75em;
  }

  .user-input wa-input {
    min-width: 0; /* fix input width in Safari */
    flex: 1 1 auto;

    &::part(form-control-label) {
      /* Visually hidden */
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      clip: rect(0 0 0 0) !important;
      clip-path: inset(50%) !important;
      border: none !important;
      overflow: hidden !important;
      white-space: nowrap !important;
      padding: 0 !important;
    }
  }

  .user-input wa-button-group {
    margin-inline-start: 0.75em;

    &::part(base) {
      flex-wrap: nowrap;
    }
  }

  .user-input wa-button:first-of-type {
    min-width: 3em;
    max-width: 3em;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(1.5em, 100%), 1fr));
    grid-gap: 0.5em;
    justify-items: center;
    border-block-start: var(--wa-form-control-border-style) var(--wa-form-control-border-width)
      var(--wa-color-surface-border);
    padding: 0.5em;
    forced-color-adjust: none;
  }

  .swatch {
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    border-radius: var(--wa-border-radius-s);
  }

  .swatch .swatch-color {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: solid 0.0625rem rgba(0, 0, 0, 0.125);
    border-radius: inherit;
    cursor: pointer;
  }

  .swatch:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  .transparent-bg {
    background-image:
      linear-gradient(45deg, var(--wa-color-neutral-fill-normal) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--wa-color-neutral-fill-normal) 75%),
      linear-gradient(45deg, transparent 75%, var(--wa-color-neutral-fill-normal) 75%),
      linear-gradient(45deg, var(--wa-color-neutral-fill-normal) 25%, transparent 25%);
    background-size: 0.5rem 0.5rem;
    background-position:
      0 0,
      0 0,
      -0.25rem -0.25rem,
      0.25rem 0.25rem;
  }

  :host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;

    .grid,
    .grid-handle,
    .slider,
    .slider-handle,
    .preview,
    .swatch,
    .swatch-color {
      pointer-events: none;
    }
  }

  /*
   * Color dropdown
   */

  .color-dropdown {
    display: contents;
  }

  .color-dropdown::part(panel) {
    max-height: none;
    background-color: var(--wa-color-surface-raised);
    border: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    overflow: visible;
  }

  .trigger {
    display: block;
    position: relative;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: inherit;
    forced-color-adjust: none;
    width: var(--wa-form-control-height);
    height: var(--wa-form-control-height);
    border-radius: var(--wa-form-control-border-radius);
  }

  .trigger:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background-color: currentColor;
    box-shadow:
      inset 0 0 0 var(--wa-form-control-border-width) var(--wa-form-control-border-color),
      inset 0 0 0 calc(var(--wa-form-control-border-width) * 3) var(--wa-color-surface-default);
  }

  .trigger-empty:before {
    background-color: transparent;
  }

  .trigger:focus-visible {
    outline: none;
  }

  .trigger:focus-visible:not(.trigger:disabled) {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  :host([disabled]) :is(.label, .trigger) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-control.form-control-has-label .label {
    cursor: pointer;
    display: inline-block;
  }
`;function Rt(t,e){Dp(t)&&(t="100%");let o=Rp(t);return t=e===360?t:Math.min(e,Math.max(0,parseFloat(t))),o&&(t=parseInt(String(t*e),10)/100),Math.abs(t-e)<1e-6?1:(e===360?t=(t<0?t%e+e:t%e)/parseFloat(String(e)):t=t%e/parseFloat(String(e)),t)}function gi(t){return Math.min(1,Math.max(0,t))}function Dp(t){return typeof t=="string"&&t.indexOf(".")!==-1&&parseFloat(t)===1}function Rp(t){return typeof t=="string"&&t.indexOf("%")!==-1}function lr(t){return t=parseFloat(t),(isNaN(t)||t<0||t>1)&&(t=1),t}function bi(t){return Number(t)<=1?`${Number(t)*100}%`:t}function no(t){return t.length===1?"0"+t:String(t)}function Rn(t,e,o){return{r:Rt(t,255)*255,g:Rt(e,255)*255,b:Rt(o,255)*255}}function fa(t,e,o){t=Rt(t,255),e=Rt(e,255),o=Rt(o,255);let i=Math.max(t,e,o),r=Math.min(t,e,o),s=0,n=0,c=(i+r)/2;if(i===r)n=0,s=0;else{let h=i-r;switch(n=c>.5?h/(2-i-r):h/(i+r),i){case t:s=(e-o)/h+(e<o?6:0);break;case e:s=(o-t)/h+2;break;case o:s=(t-e)/h+4;break;default:break}s/=6}return{h:s,s:n,l:c}}function ma(t,e,o){return o<0&&(o+=1),o>1&&(o-=1),o<1/6?t+(e-t)*(6*o):o<1/2?e:o<2/3?t+(e-t)*(2/3-o)*6:t}function Pn(t,e,o){let i,r,s;if(t=Rt(t,360),e=Rt(e,100),o=Rt(o,100),e===0)r=o,s=o,i=o;else{let n=o<.5?o*(1+e):o+e-o*e,c=2*o-n;i=ma(c,n,t+1/3),r=ma(c,n,t),s=ma(c,n,t-1/3)}return{r:i*255,g:r*255,b:s*255}}function ga(t,e,o){t=Rt(t,255),e=Rt(e,255),o=Rt(o,255);let i=Math.max(t,e,o),r=Math.min(t,e,o),s=0,n=i,c=i-r,h=i===0?0:c/i;if(i===r)s=0;else{switch(i){case t:s=(e-o)/c+(e<o?6:0);break;case e:s=(o-t)/c+2;break;case o:s=(t-e)/c+4;break;default:break}s/=6}return{h:s,s:h,v:n}}function On(t,e,o){t=Rt(t,360)*6,e=Rt(e,100),o=Rt(o,100);let i=Math.floor(t),r=t-i,s=o*(1-e),n=o*(1-r*e),c=o*(1-(1-r)*e),h=i%6,d=[o,n,s,s,c,o][h],u=[c,o,o,n,s,s][h],b=[s,s,c,o,o,n][h];return{r:d*255,g:u*255,b:b*255}}function ba(t,e,o,i){let r=[no(Math.round(t).toString(16)),no(Math.round(e).toString(16)),no(Math.round(o).toString(16))];return i&&r[0].startsWith(r[0].charAt(1))&&r[1].startsWith(r[1].charAt(1))&&r[2].startsWith(r[2].charAt(1))?r[0].charAt(0)+r[1].charAt(0)+r[2].charAt(0):r.join("")}function Bn(t,e,o,i,r){let s=[no(Math.round(t).toString(16)),no(Math.round(e).toString(16)),no(Math.round(o).toString(16)),no(Pp(i))];return r&&s[0].startsWith(s[0].charAt(1))&&s[1].startsWith(s[1].charAt(1))&&s[2].startsWith(s[2].charAt(1))&&s[3].startsWith(s[3].charAt(1))?s[0].charAt(0)+s[1].charAt(0)+s[2].charAt(0)+s[3].charAt(0):s.join("")}function Fn(t,e,o,i){let r=t/100,s=e/100,n=o/100,c=i/100,h=255*(1-r)*(1-c),d=255*(1-s)*(1-c),u=255*(1-n)*(1-c);return{r:h,g:d,b:u}}function va(t,e,o){let i=1-t/255,r=1-e/255,s=1-o/255,n=Math.min(i,r,s);return n===1?(i=0,r=0,s=0):(i=(i-n)/(1-n)*100,r=(r-n)/(1-n)*100,s=(s-n)/(1-n)*100),n*=100,{c:Math.round(i),m:Math.round(r),y:Math.round(s),k:Math.round(n)}}function Pp(t){return Math.round(parseFloat(t)*255).toString(16)}function wa(t){return ie(t)/255}function ie(t){return parseInt(t,16)}function Vn(t){return{r:t>>16,g:(t&65280)>>8,b:t&255}}var vi={aliceblue:"#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgreen:"#006400",darkgrey:"#a9a9a9",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dimgrey:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",goldenrod:"#daa520",gold:"#ffd700",gray:"#808080",green:"#008000",greenyellow:"#adff2f",grey:"#808080",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",lavenderblush:"#fff0f5",lavender:"#e6e6fa",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",lightgreen:"#90ee90",lightgrey:"#d3d3d3",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#778899",lightslategrey:"#778899",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370db",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#db7093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",rebeccapurple:"#663399",red:"#ff0000",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",slategrey:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",yellow:"#ffff00",yellowgreen:"#9acd32"};function qn(t){let e={r:0,g:0,b:0},o=1,i=null,r=null,s=null,n=!1,c=!1;return typeof t=="string"&&(t=Fp(t)),typeof t=="object"&&(le(t.r)&&le(t.g)&&le(t.b)?(e=Rn(t.r,t.g,t.b),n=!0,c=String(t.r).substr(-1)==="%"?"prgb":"rgb"):le(t.h)&&le(t.s)&&le(t.v)?(i=bi(t.s),r=bi(t.v),e=On(t.h,i,r),n=!0,c="hsv"):le(t.h)&&le(t.s)&&le(t.l)?(i=bi(t.s),s=bi(t.l),e=Pn(t.h,i,s),n=!0,c="hsl"):le(t.c)&&le(t.m)&&le(t.y)&&le(t.k)&&(e=Fn(t.c,t.m,t.y,t.k),n=!0,c="cmyk"),Object.prototype.hasOwnProperty.call(t,"a")&&(o=t.a)),o=lr(o),{ok:n,format:t.format||c,r:Math.min(255,Math.max(e.r,0)),g:Math.min(255,Math.max(e.g,0)),b:Math.min(255,Math.max(e.b,0)),a:o}}var Op="[-\\+]?\\d+%?",Bp="[-\\+]?\\d*\\.\\d+%?",lo="(?:"+Bp+")|(?:"+Op+")",ya="[\\s|\\(]+("+lo+")[,|\\s]+("+lo+")[,|\\s]+("+lo+")\\s*\\)?",cr="[\\s|\\(]+("+lo+")[,|\\s]+("+lo+")[,|\\s]+("+lo+")[,|\\s]+("+lo+")\\s*\\)?",ve={CSS_UNIT:new RegExp(lo),rgb:new RegExp("rgb"+ya),rgba:new RegExp("rgba"+cr),hsl:new RegExp("hsl"+ya),hsla:new RegExp("hsla"+cr),hsv:new RegExp("hsv"+ya),hsva:new RegExp("hsva"+cr),cmyk:new RegExp("cmyk"+cr),hex3:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex6:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,hex4:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex8:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/};function Fp(t){if(t=t.trim().toLowerCase(),t.length===0)return!1;let e=!1;if(vi[t])t=vi[t],e=!0;else if(t==="transparent")return{r:0,g:0,b:0,a:0,format:"name"};let o=ve.rgb.exec(t);return o?{r:o[1],g:o[2],b:o[3]}:(o=ve.rgba.exec(t),o?{r:o[1],g:o[2],b:o[3],a:o[4]}:(o=ve.hsl.exec(t),o?{h:o[1],s:o[2],l:o[3]}:(o=ve.hsla.exec(t),o?{h:o[1],s:o[2],l:o[3],a:o[4]}:(o=ve.hsv.exec(t),o?{h:o[1],s:o[2],v:o[3]}:(o=ve.hsva.exec(t),o?{h:o[1],s:o[2],v:o[3],a:o[4]}:(o=ve.cmyk.exec(t),o?{c:o[1],m:o[2],y:o[3],k:o[4]}:(o=ve.hex8.exec(t),o?{r:ie(o[1]),g:ie(o[2]),b:ie(o[3]),a:wa(o[4]),format:e?"name":"hex8"}:(o=ve.hex6.exec(t),o?{r:ie(o[1]),g:ie(o[2]),b:ie(o[3]),format:e?"name":"hex"}:(o=ve.hex4.exec(t),o?{r:ie(o[1]+o[1]),g:ie(o[2]+o[2]),b:ie(o[3]+o[3]),a:wa(o[4]+o[4]),format:e?"name":"hex8"}:(o=ve.hex3.exec(t),o?{r:ie(o[1]+o[1]),g:ie(o[2]+o[2]),b:ie(o[3]+o[3]),format:e?"name":"hex"}:!1))))))))))}function le(t){return typeof t=="number"?!Number.isNaN(t):ve.CSS_UNIT.test(t)}var wi=class t{constructor(e="",o={}){if(e instanceof t)return e;typeof e=="number"&&(e=Vn(e)),this.originalInput=e;let i=qn(e);this.originalInput=e,this.r=i.r,this.g=i.g,this.b=i.b,this.a=i.a,this.roundA=Math.round(100*this.a)/100,this.format=o.format??i.format,this.gradientType=o.gradientType,this.r<1&&(this.r=Math.round(this.r)),this.g<1&&(this.g=Math.round(this.g)),this.b<1&&(this.b=Math.round(this.b)),this.isValid=i.ok}isDark(){return this.getBrightness()<128}isLight(){return!this.isDark()}getBrightness(){let e=this.toRgb();return(e.r*299+e.g*587+e.b*114)/1e3}getLuminance(){let e=this.toRgb(),o,i,r,s=e.r/255,n=e.g/255,c=e.b/255;return s<=.03928?o=s/12.92:o=Math.pow((s+.055)/1.055,2.4),n<=.03928?i=n/12.92:i=Math.pow((n+.055)/1.055,2.4),c<=.03928?r=c/12.92:r=Math.pow((c+.055)/1.055,2.4),.2126*o+.7152*i+.0722*r}getAlpha(){return this.a}setAlpha(e){return this.a=lr(e),this.roundA=Math.round(100*this.a)/100,this}isMonochrome(){let{s:e}=this.toHsl();return e===0}toHsv(){let e=ga(this.r,this.g,this.b);return{h:e.h*360,s:e.s,v:e.v,a:this.a}}toHsvString(){let e=ga(this.r,this.g,this.b),o=Math.round(e.h*360),i=Math.round(e.s*100),r=Math.round(e.v*100);return this.a===1?`hsv(${o}, ${i}%, ${r}%)`:`hsva(${o}, ${i}%, ${r}%, ${this.roundA})`}toHsl(){let e=fa(this.r,this.g,this.b);return{h:e.h*360,s:e.s,l:e.l,a:this.a}}toHslString(){let e=fa(this.r,this.g,this.b),o=Math.round(e.h*360),i=Math.round(e.s*100),r=Math.round(e.l*100);return this.a===1?`hsl(${o}, ${i}%, ${r}%)`:`hsla(${o}, ${i}%, ${r}%, ${this.roundA})`}toHex(e=!1){return ba(this.r,this.g,this.b,e)}toHexString(e=!1){return"#"+this.toHex(e)}toHex8(e=!1){return Bn(this.r,this.g,this.b,this.a,e)}toHex8String(e=!1){return"#"+this.toHex8(e)}toHexShortString(e=!1){return this.a===1?this.toHexString(e):this.toHex8String(e)}toRgb(){return{r:Math.round(this.r),g:Math.round(this.g),b:Math.round(this.b),a:this.a}}toRgbString(){let e=Math.round(this.r),o=Math.round(this.g),i=Math.round(this.b);return this.a===1?`rgb(${e}, ${o}, ${i})`:`rgba(${e}, ${o}, ${i}, ${this.roundA})`}toPercentageRgb(){let e=o=>`${Math.round(Rt(o,255)*100)}%`;return{r:e(this.r),g:e(this.g),b:e(this.b),a:this.a}}toPercentageRgbString(){let e=o=>Math.round(Rt(o,255)*100);return this.a===1?`rgb(${e(this.r)}%, ${e(this.g)}%, ${e(this.b)}%)`:`rgba(${e(this.r)}%, ${e(this.g)}%, ${e(this.b)}%, ${this.roundA})`}toCmyk(){return{...va(this.r,this.g,this.b)}}toCmykString(){let{c:e,m:o,y:i,k:r}=va(this.r,this.g,this.b);return`cmyk(${e}, ${o}, ${i}, ${r})`}toName(){if(this.a===0)return"transparent";if(this.a<1)return!1;let e="#"+ba(this.r,this.g,this.b,!1);for(let[o,i]of Object.entries(vi))if(e===i)return o;return!1}toString(e){let o=!!e;e=e??this.format;let i=!1,r=this.a<1&&this.a>=0;return!o&&r&&(e.startsWith("hex")||e==="name")?e==="name"&&this.a===0?this.toName():this.toRgbString():(e==="rgb"&&(i=this.toRgbString()),e==="prgb"&&(i=this.toPercentageRgbString()),(e==="hex"||e==="hex6")&&(i=this.toHexString()),e==="hex3"&&(i=this.toHexString(!0)),e==="hex4"&&(i=this.toHex8String(!0)),e==="hex8"&&(i=this.toHex8String()),e==="name"&&(i=this.toName()),e==="hsl"&&(i=this.toHslString()),e==="hsv"&&(i=this.toHsvString()),e==="cmyk"&&(i=this.toCmykString()),i||this.toHexString())}toNumber(){return(Math.round(this.r)<<16)+(Math.round(this.g)<<8)+Math.round(this.b)}clone(){return new t(this.toString())}lighten(e=10){let o=this.toHsl();return o.l+=e/100,o.l=gi(o.l),new t(o)}brighten(e=10){let o=this.toRgb();return o.r=Math.max(0,Math.min(255,o.r-Math.round(255*-(e/100)))),o.g=Math.max(0,Math.min(255,o.g-Math.round(255*-(e/100)))),o.b=Math.max(0,Math.min(255,o.b-Math.round(255*-(e/100)))),new t(o)}darken(e=10){let o=this.toHsl();return o.l-=e/100,o.l=gi(o.l),new t(o)}tint(e=10){return this.mix("white",e)}shade(e=10){return this.mix("black",e)}desaturate(e=10){let o=this.toHsl();return o.s-=e/100,o.s=gi(o.s),new t(o)}saturate(e=10){let o=this.toHsl();return o.s+=e/100,o.s=gi(o.s),new t(o)}greyscale(){return this.desaturate(100)}spin(e){let o=this.toHsl(),i=(o.h+e)%360;return o.h=i<0?360+i:i,new t(o)}mix(e,o=50){let i=this.toRgb(),r=new t(e).toRgb(),s=o/100,n={r:(r.r-i.r)*s+i.r,g:(r.g-i.g)*s+i.g,b:(r.b-i.b)*s+i.b,a:(r.a-i.a)*s+i.a};return new t(n)}analogous(e=6,o=30){let i=this.toHsl(),r=360/o,s=[this];for(i.h=(i.h-(r*e>>1)+720)%360;--e;)i.h=(i.h+r)%360,s.push(new t(i));return s}complement(){let e=this.toHsl();return e.h=(e.h+180)%360,new t(e)}monochromatic(e=6){let o=this.toHsv(),{h:i}=o,{s:r}=o,{v:s}=o,n=[],c=1/e;for(;e--;)n.push(new t({h:i,s:r,v:s})),s=(s+c)%1;return n}splitcomplement(){let e=this.toHsl(),{h:o}=e;return[this,new t({h:(o+72)%360,s:e.s,l:e.l}),new t({h:(o+216)%360,s:e.s,l:e.l})]}onBackground(e){let o=this.toRgb(),i=new t(e).toRgb(),r=o.a+i.a*(1-o.a);return new t({r:(o.r*o.a+i.r*i.a*(1-o.a))/r,g:(o.g*o.a+i.g*i.a*(1-o.a))/r,b:(o.b*o.a+i.b*i.a*(1-o.a))/r,a:r})}triad(){return this.polyad(3)}tetrad(){return this.polyad(4)}polyad(e){let o=this.toHsl(),{h:i}=o,r=[this],s=360/e;for(let n=1;n<e;n++)r.push(new t({h:(i+n*s)%360,s:o.s,l:o.l}));return r}equals(e){let o=new t(e);return this.format==="cmyk"||o.format==="cmyk"?this.toCmykString()===o.toCmykString():this.toRgbString()===o.toRgbString()}};var N=class extends q{constructor(){super(),this.hasSlotController=new Z(this,"hint","label"),this.isSafeValue=!1,this.localize=new I(this),this.hasFocus=!1,this.isDraggingGridHandle=!1,this.inputValue="",this.hue=0,this.isEmpty=!0,this.saturation=100,this.brightness=100,this.alpha=100,this._value=null,this.defaultValue=this.getAttribute("value")||null,this.withLabel=!1,this.withHint=!1,this.hasEyeDropper=!1,this.label="",this.hint="",this.format="hex",this.size="m",this.placement="bottom-start",this.withoutFormatToggle=!1,this.name=null,this.disabled=!1,this.open=!1,this.opacity=!1,this.uppercase=!1,this.swatches="",this.required=!1,this.handleFocusIn=()=>{this.hasFocus=!0},this.handleFocusOut=()=>{this.hasFocus=!1},this.reportValidityAfterShow=()=>{this.removeEventListener("invalid",this.emitInvalid),this.reportValidity(),this.addEventListener("invalid",this.emitInvalid)},this.handleKeyDown=e=>{this.open&&e.key==="Escape"&&Dt(this)&&(e.stopPropagation(),this.hide(),this.focus())},this.handleDocumentKeyDown=e=>{if(e.key==="Escape"&&this.open&&Dt(this)){e.stopPropagation(),this.focus(),this.hide();return}e.key==="Tab"&&setTimeout(()=>{let o=this.getRootNode()instanceof ShadowRoot?document.activeElement?.shadowRoot?.activeElement:document.activeElement;(!this||o?.closest(this.tagName.toLowerCase())!==this)&&this.hide()})},this.handleDocumentMouseDown=e=>{let i=e.composedPath().some(r=>r instanceof Element&&(r.closest(".color-picker")||r===this.trigger));this&&!i&&this.hide()},this.addEventListener("focusin",this.handleFocusIn),this.addEventListener("focusout",this.handleFocusOut),this.opacity=this.hasAttribute("opacity"),this.uppercase=this.hasAttribute("uppercase");let t=this.getAttribute("format");(t==="rgb"||t==="hsl"||t==="hsv")&&(this.format=t),this.handleValueChange("",this.value||"")}static get validators(){let t=[oe()];return[...super.validators,...t]}get validationTarget(){return this.popup?.active?this.input:this.trigger}get value(){return this.valueHasChanged?this._value:this._value??this.defaultValue}set value(t){this._value!==t&&(this.valueHasChanged=!0,this._value=t)}handleSizeChange(){U(this.localName,this.size)}updateFormValue(t){if(t==null){this.setValue("",null);return}super.updateFormValue(t)}handleCopy(){this.input.select(),document.execCommand("copy"),this.previewButton.focus(),this.previewButton.classList.add("preview-color-copied"),this.previewButton.addEventListener("animationend",()=>{this.previewButton.classList.remove("preview-color-copied")})}handleFormatToggle(){let t=["hex","rgb","hsl","hsv"],e=(t.indexOf(this.format)+1)%t.length;this.format=t[e],this.setColor(this.value||""),this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))})}handleAlphaDrag(t){let e=this.shadowRoot.querySelector(".slider.alpha"),o=e.querySelector(".slider-handle"),{width:i}=e.getBoundingClientRect(),r=this.value,s=this.value;o.focus(),t.preventDefault(),so(e,{onMove:n=>{this.alpha=W(n/i*100,0,100),this.syncValues(),this.value!==s&&(s=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))}))},onStop:()=>{this.value!==r&&(r=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))},initialEvent:t})}handleHueDrag(t){let e=this.shadowRoot.querySelector(".slider.hue"),o=e.querySelector(".slider-handle"),{width:i}=e.getBoundingClientRect(),r=this.value,s=this.value;o.focus(),t.preventDefault(),so(e,{onMove:n=>{this.hue=W(n/i*360,0,360),this.syncValues(),this.value!==s&&(s=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input"))}))},onStop:()=>{this.value!==r&&(r=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))},initialEvent:t})}handleGridDrag(t){let e=this.shadowRoot.querySelector(".grid"),o=e.querySelector(".grid-handle"),{width:i,height:r}=e.getBoundingClientRect(),s=this.value,n=this.value;o.focus(),t.preventDefault(),this.isDraggingGridHandle=!0,so(e,{onMove:(c,h)=>{this.saturation=W(c/i*100,0,100),this.brightness=W(100-h/r*100,0,100),this.syncValues(),this.value!==n&&(n=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))}))},onStop:()=>{this.isDraggingGridHandle=!1,this.value!==s&&(s=this.value,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))},initialEvent:t})}handleAlphaKeyDown(t){let e=t.shiftKey?10:1,o=this.value;t.key==="ArrowLeft"&&(t.preventDefault(),this.alpha=W(this.alpha-e,0,100),this.syncValues()),t.key==="ArrowRight"&&(t.preventDefault(),this.alpha=W(this.alpha+e,0,100),this.syncValues()),t.key==="Home"&&(t.preventDefault(),this.alpha=0,this.syncValues()),t.key==="End"&&(t.preventDefault(),this.alpha=100,this.syncValues()),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}handleHueKeyDown(t){let e=t.shiftKey?10:1,o=this.value;t.key==="ArrowLeft"&&(t.preventDefault(),this.hue=W(this.hue-e,0,360),this.syncValues()),t.key==="ArrowRight"&&(t.preventDefault(),this.hue=W(this.hue+e,0,360),this.syncValues()),t.key==="Home"&&(t.preventDefault(),this.hue=0,this.syncValues()),t.key==="End"&&(t.preventDefault(),this.hue=360,this.syncValues()),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}handleGridKeyDown(t){let e=t.shiftKey?10:1,o=this.value;t.key==="ArrowLeft"&&(t.preventDefault(),this.saturation=W(this.saturation-e,0,100),this.syncValues()),t.key==="ArrowRight"&&(t.preventDefault(),this.saturation=W(this.saturation+e,0,100),this.syncValues()),t.key==="ArrowUp"&&(t.preventDefault(),this.brightness=W(this.brightness+e,0,100),this.syncValues()),t.key==="ArrowDown"&&(t.preventDefault(),this.brightness=W(this.brightness-e,0,100),this.syncValues()),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}handleInputChange(t){let e=t.target,o=this.value;t.stopPropagation(),this.input.value?(this.setColor(e.value),e.value=this.value||""):this.value="",this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}handleInputInput(t){this.updateValidity(),t.stopPropagation()}handleInputKeyDown(t){if(t.key==="Enter"){let e=this.value;this.input.value?(this.setColor(this.input.value),this.input.value=this.value,this.value!==e&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),setTimeout(()=>this.input.select())):this.hue=0}}handleTouchMove(t){t.preventDefault()}parseColor(t){if(!t||t.trim()==="")return null;let e=new wi(t);if(!e.isValid)return null;let o=e.toHsl(),i=e.toRgb(),r=e.toHsv();if(!i||i.r==null||i.g==null||i.b==null)return null;let s={h:o.h||0,s:(o.s||0)*100,l:(o.l||0)*100,a:o.a||0},n=e.toHexString(),c=e.toHex8String(),h={h:r.h||0,s:(r.s||0)*100,v:(r.v||0)*100,a:r.a||0};return{hsl:{h:s.h,s:s.s,l:s.l,string:this.setLetterCase(`hsl(${Math.round(s.h)}, ${Math.round(s.s)}%, ${Math.round(s.l)}%)`)},hsla:{h:s.h,s:s.s,l:s.l,a:s.a,string:this.setLetterCase(`hsla(${Math.round(s.h)}, ${Math.round(s.s)}%, ${Math.round(s.l)}%, ${s.a.toFixed(2).toString()})`)},hsv:{h:h.h,s:h.s,v:h.v,string:this.setLetterCase(`hsv(${Math.round(h.h)}, ${Math.round(h.s)}%, ${Math.round(h.v)}%)`)},hsva:{h:h.h,s:h.s,v:h.v,a:h.a,string:this.setLetterCase(`hsva(${Math.round(h.h)}, ${Math.round(h.s)}%, ${Math.round(h.v)}%, ${h.a.toFixed(2).toString()})`)},rgb:{r:i.r,g:i.g,b:i.b,string:this.setLetterCase(`rgb(${Math.round(i.r)}, ${Math.round(i.g)}, ${Math.round(i.b)})`)},rgba:{r:i.r,g:i.g,b:i.b,a:i.a||0,string:this.setLetterCase(`rgba(${Math.round(i.r)}, ${Math.round(i.g)}, ${Math.round(i.b)}, ${(i.a||0).toFixed(2).toString()})`)},hex:this.setLetterCase(n),hexa:this.setLetterCase(c)}}setColor(t){let e=this.parseColor(t);return e===null?!1:(this.hue=e.hsva.h,this.saturation=e.hsva.s,this.brightness=e.hsva.v,this.alpha=this.opacity?e.hsva.a*100:100,this.syncValues(),!0)}setLetterCase(t){return typeof t!="string"?"":this.uppercase?t.toUpperCase():t.toLowerCase()}async syncValues(){let t=this.parseColor(`hsva(${this.hue}, ${this.saturation}%, ${this.brightness}%, ${this.alpha/100})`);t!==null&&(this.format==="hsl"?this.inputValue=this.opacity?t.hsla.string:t.hsl.string:this.format==="rgb"?this.inputValue=this.opacity?t.rgba.string:t.rgb.string:this.format==="hsv"?this.inputValue=this.opacity?t.hsva.string:t.hsv.string:this.inputValue=this.opacity?t.hexa:t.hex,this.isSafeValue=!0,this.value=this.inputValue,await this.updateComplete,this.isSafeValue=!1)}handleAfterHide(){this.previewButton.classList.remove("preview-color-copied"),this.updateValidity()}handleAfterShow(){this.updateValidity()}handleEyeDropper(){if(!this.hasEyeDropper)return;new EyeDropper().open().then(e=>{let o=this.value;this.setColor(e.sRGBHex),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}).catch(()=>{})}selectSwatch(t){let e=this.value;this.disabled||(this.setColor(t),this.value!==e&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))}getHexString(t,e,o,i=100){let r=new wi(`hsva(${t}, ${e}%, ${o}%, ${i/100})`);return r.isValid?r.toHex8String():""}stopNestedEventPropagation(t){t.stopImmediatePropagation()}handleFormatChange(){this.syncValues()}handleOpacityChange(){this.alpha=100}willUpdate(t){(t.has("value")||t.has("defaultValue"))&&this.handleValueChange(t.get("value")||"",this.value||""),super.willUpdate(t)}handleValueChange(t,e){if(this.isEmpty=!e,e||(this.hue=0,this.saturation=0,this.brightness=100,this.alpha=100),!this.isSafeValue){let o=this.parseColor(e);o!==null?(this.inputValue=this.value||"",this.hue=o.hsva.h,this.saturation=o.hsva.s,this.brightness=o.hsva.v,this.alpha=this.opacity?o.hsva.a*100:100,this.syncValues()):this.inputValue=t??""}this.requestUpdate()}focus(t){this.trigger.focus(t)}blur(){let t=this.trigger;this.hasFocus&&(t.focus({preventScroll:!0}),t.blur()),this.popup?.active&&this.hide()}getFormattedValue(t="hex"){let e=this.parseColor(`hsva(${this.hue}, ${this.saturation}%, ${this.brightness}%, ${this.alpha/100})`);if(e===null)return"";switch(t){case"hex":return e.hex;case"hexa":return e.hexa;case"rgb":return e.rgb.string;case"rgba":return e.rgba.string;case"hsl":return e.hsl.string;case"hsla":return e.hsla.string;case"hsv":return e.hsv.string;case"hsva":return e.hsva.string;default:return""}}reportValidity(){return!this.validity.valid&&!this.open?(this.addEventListener("wa-after-show",this.reportValidityAfterShow,{once:!0}),this.show(),this.disabled||this.dispatchEvent(new Ko),!1):super.reportValidity()}formResetCallback(){this.value=this.defaultValue,super.formResetCallback()}firstUpdated(t){super.firstUpdated(t),this.hasEyeDropper="EyeDropper"in window}handleTriggerClick(){this.open?this.hide():(this.show(),this.focus())}async handleTriggerKeyDown(t){if([" ","Enter"].includes(t.key)){t.preventDefault(),this.handleTriggerClick();return}}handleTriggerKeyUp(t){t.key===" "&&t.preventDefault()}updateAccessibleTrigger(){let t=this.trigger;t&&(t.setAttribute("aria-haspopup","true"),t.setAttribute("aria-expanded",this.open?"true":"false"))}async show(){if(!this.open)return this.open=!0,Ct(this,"wa-after-show")}async hide(){if(this.open)return this.open=!1,Ct(this,"wa-after-hide")}addOpenListeners(){this.base.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown),Kt(this)}removeOpenListeners(){this.base&&this.base.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),It(this)}async handleOpenChange(){if(this.disabled){this.open=!1;return}this.updateAccessibleTrigger(),this.open?(this.dispatchEvent(new CustomEvent("wa-show")),this.addOpenListeners(),await this.updateComplete,this.base.hidden=!1,this.popup.active=!0,await G(this.popup.popup,"show-with-scale"),this.dispatchEvent(new CustomEvent("wa-after-show"))):(this.dispatchEvent(new CustomEvent("wa-hide")),this.removeOpenListeners(),await G(this.popup.popup,"hide-with-scale"),this.base.hidden=!0,this.popup.active=!1,this.dispatchEvent(new CustomEvent("wa-after-hide")))}render(){let t=this.isEmpty,e=this.hasSlotController.test("label","withLabel"),o=this.hasSlotController.test("hint","withHint"),i=this.label?!0:!!e,r=this.hint?!0:!!o,s=this.saturation,n=100-this.brightness,c=Array.isArray(this.swatches)?this.swatches.map(d=>typeof d=="string"?{color:d,label:d}:d):this.swatches.split(";").filter(d=>d.trim()!=="").map(d=>({color:d.trim(),label:d.trim()})),h=p`
      <div
        part="base color-picker"
        class=${_({"color-picker":!0})}
        aria-disabled=${this.disabled?"true":"false"}
        tabindex="-1"
      >
        <div
          part="grid"
          class="grid"
          style=${ct({backgroundColor:this.getHexString(this.hue,100,100)})}
          @pointerdown=${this.handleGridDrag}
          @touchmove=${this.handleTouchMove}
        >
          <span
            part="grid-handle"
            class=${_({"grid-handle":!0,"grid-handle-dragging":this.isDraggingGridHandle})}
            style=${ct({top:`${n}%`,left:`${s}%`,backgroundColor:this.getHexString(this.hue,this.saturation,this.brightness,this.alpha)})}
            role="application"
            aria-label="HSV"
            tabindex=${M(this.disabled?void 0:"0")}
            @keydown=${this.handleGridKeyDown}
          ></span>
        </div>

        <div class="controls">
          <div class="sliders">
            <div
              part="slider hue-slider"
              class="hue slider"
              @pointerdown=${this.handleHueDrag}
              @touchmove=${this.handleTouchMove}
            >
              <span
                part="slider-handle hue-slider-handle"
                class="slider-handle"
                style=${ct({left:`${this.hue===0?0:100/(360/this.hue)}%`,backgroundColor:this.getHexString(this.hue,100,100)})}
                role="slider"
                aria-label="hue"
                aria-orientation="horizontal"
                aria-valuemin="0"
                aria-valuemax="360"
                aria-valuenow=${`${Math.round(this.hue)}`}
                tabindex=${M(this.disabled?void 0:"0")}
                @keydown=${this.handleHueKeyDown}
              ></span>
            </div>

            ${this.opacity?p`
                  <div
                    part="slider opacity-slider"
                    class="alpha slider transparent-bg"
                    @pointerdown="${this.handleAlphaDrag}"
                    @touchmove=${this.handleTouchMove}
                  >
                    <div
                      class="alpha-gradient"
                      style=${ct({backgroundImage:`linear-gradient(
                          to right,
                          ${this.getHexString(this.hue,this.saturation,this.brightness,0)} 0%,
                          ${this.getHexString(this.hue,this.saturation,this.brightness,100)} 100%
                        )`})}
                    ></div>
                    <span
                      part="slider-handle opacity-slider-handle"
                      class="slider-handle"
                      style=${ct({left:`${this.alpha}%`,backgroundColor:this.getHexString(this.hue,this.saturation,this.brightness,this.alpha)})}
                      role="slider"
                      aria-label="alpha"
                      aria-orientation="horizontal"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow=${Math.round(this.alpha)}
                      tabindex=${M(this.disabled?void 0:"0")}
                      @keydown=${this.handleAlphaKeyDown}
                    ></span>
                  </div>
                `:""}
          </div>

          <button
            type="button"
            part="preview"
            class="preview transparent-bg"
            aria-label=${this.localize.term("copy")}
            style=${ct({"--preview-color":this.getHexString(this.hue,this.saturation,this.brightness,this.alpha)})}
            @click=${this.handleCopy}
          ></button>
        </div>

        <div class="user-input" aria-live="polite">
          <wa-input
            part="input"
            type="text"
            name=${this.name}
            size="s"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            .value=${t?"":this.inputValue}
            value=${t?"":this.inputValue}
            ?required=${this.required}
            ?disabled=${this.disabled}
            aria-label=${this.localize.term("currentValue")}
            @keydown=${this.handleInputKeyDown}
            @change=${this.handleInputChange}
            @input=${this.handleInputInput}
            @blur=${this.stopNestedEventPropagation}
            @focus=${this.stopNestedEventPropagation}
          ></wa-input>

          <wa-button-group>
            ${this.withoutFormatToggle?"":p`
                  <wa-button
                    part="format-button"
                    size="s"
                    appearance="outlined"
                    aria-label=${this.localize.term("toggleColorFormat")}
                    exportparts="
                      base:format-button__base,
                      start:format-button__start,
                      label:format-button__label,
                      end:format-button__end,
                      caret:format-button__caret
                    "
                    @click=${this.handleFormatToggle}
                    @blur=${this.stopNestedEventPropagation}
                    @focus=${this.stopNestedEventPropagation}
                  >
                    ${this.setLetterCase(this.format)}
                  </wa-button>
                `}
            ${this.hasEyeDropper?p`
                  <wa-button
                    part="eyedropper-button"
                    size="s"
                    appearance="outlined"
                    exportparts="
                      base:eyedropper-button__base,
                      start:eyedropper-button__start,
                      label:eyedropper-button__label,
                      end:eyedropper-button__end,
                      caret:eyedropper-button__caret
                    "
                    @click=${this.handleEyeDropper}
                    @blur=${this.stopNestedEventPropagation}
                    @focus=${this.stopNestedEventPropagation}
                  >
                    <wa-icon
                      library="system"
                      name="eyedropper"
                      variant="solid"
                      label=${this.localize.term("selectAColorFromTheScreen")}
                    ></wa-icon>
                  </wa-button>
                `:""}
          </wa-button-group>
        </div>

        ${c.length>0?p`
              <div part="swatches" class="swatches">
                ${c.map(d=>{let u=this.parseColor(d.color);return u?p`
                    <div
                      part="swatch"
                      class="swatch transparent-bg"
                      tabindex=${M(this.disabled?void 0:"0")}
                      role="button"
                      aria-label=${d.label}
                      @click=${()=>this.selectSwatch(d.color)}
                      @keydown=${b=>{(b.key==="Enter"||b.key===" ")&&(b.preventDefault(),this.selectSwatch(d.color))}}
                    >
                      <div class="swatch-color" style=${ct({backgroundColor:u.hexa})}></div>
                    </div>
                  `:""})}
              </div>
            `:""}
      </div>
    `;return p`
      <div
        class=${_({container:!0,"form-control":!0,"form-control-has-label":i})}
        part="trigger-container form-control"
      >
        <div
          part="form-control-label"
          class=${_({label:!0,"has-label":i})}
          id="form-control-label"
        >
          <slot name="label">${this.label}</slot>
        </div>

        <button
          id="trigger"
          part="trigger form-control-input"
          class=${_({trigger:!0,"trigger-empty":t,"transparent-bg":!0,"form-control-input":!0})}
          style=${ct({color:this.getHexString(this.hue,this.saturation,this.brightness,this.alpha)})}
          type="button"
          aria-labelledby="form-control-label"
          aria-describedby="hint"
          .disabled=${this.disabled}
          @click=${this.handleTriggerClick}
          @keydown=${this.handleTriggerKeyDown}
          @keyup=${this.handleTriggerKeyUp}
        ></button>

        <slot
          id="hint"
          name="hint"
          part="hint"
          class=${_({"has-slotted":r})}
          >${this.hint}</slot
        >
      </div>

      <wa-popup
        class="color-popup"
        anchor="trigger"
        placement=${this.placement}
        distance="0"
        skidding="0"
        flip
        flip-fallback-strategy="best-fit"
        shift
        shift-padding="10"
        aria-disabled=${this.disabled?"true":"false"}
        @wa-after-show=${this.handleAfterShow}
        @wa-after-hide=${this.handleAfterHide}
      >
        ${h}
      </wa-popup>
    `}};N.css=[Pe,j,pt,Dn];N.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S('[part~="base"]')],N.prototype,"base",2);a([S('[part~="input"]')],N.prototype,"input",2);a([S('[part~="form-control-label"]')],N.prototype,"triggerLabel",2);a([S('[part~="form-control-input"]')],N.prototype,"triggerButton",2);a([S(".color-popup")],N.prototype,"popup",2);a([S('[part~="preview"]')],N.prototype,"previewButton",2);a([S('[part~="trigger"]')],N.prototype,"trigger",2);a([A()],N.prototype,"hasFocus",2);a([A()],N.prototype,"isDraggingGridHandle",2);a([A()],N.prototype,"inputValue",2);a([A()],N.prototype,"hue",2);a([A()],N.prototype,"isEmpty",2);a([A()],N.prototype,"saturation",2);a([A()],N.prototype,"brightness",2);a([A()],N.prototype,"alpha",2);a([A()],N.prototype,"value",1);a([l({attribute:"value",reflect:!0})],N.prototype,"defaultValue",2);a([l({attribute:"with-label",reflect:!0,type:Boolean})],N.prototype,"withLabel",2);a([l({attribute:"with-hint",reflect:!0,type:Boolean})],N.prototype,"withHint",2);a([A()],N.prototype,"hasEyeDropper",2);a([l()],N.prototype,"label",2);a([l({attribute:"hint"})],N.prototype,"hint",2);a([l()],N.prototype,"format",2);a([l({reflect:!0})],N.prototype,"size",2);a([y("size")],N.prototype,"handleSizeChange",1);a([l({reflect:!0})],N.prototype,"placement",2);a([l({attribute:"without-format-toggle",type:Boolean})],N.prototype,"withoutFormatToggle",2);a([l({reflect:!0})],N.prototype,"name",2);a([l({type:Boolean})],N.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],N.prototype,"open",2);a([l({type:Boolean})],N.prototype,"opacity",2);a([l({type:Boolean})],N.prototype,"uppercase",2);a([l()],N.prototype,"swatches",2);a([l({type:Boolean,reflect:!0})],N.prototype,"required",2);a([No({passive:!1})],N.prototype,"handleTouchMove",1);a([y("format",{waitUntilFirstUpdate:!0})],N.prototype,"handleFormatChange",1);a([y("opacity",{waitUntilFirstUpdate:!0})],N.prototype,"handleOpacityChange",1);a([y("value")],N.prototype,"handleValueChange",1);a([y("open",{waitUntilFirstUpdate:!0})],N.prototype,"handleOpenChange",1);N=a([k("wa-color-picker")],N);N.disableWarning?.("change-in-update");var co=class extends Event{constructor(){super("wa-clear",{bubbles:!0,cancelable:!1,composed:!0})}};function ho(t,e){let o=t.metaKey||t.ctrlKey||t.shiftKey||t.altKey;t.key==="Enter"&&!o&&setTimeout(()=>{!t.defaultPrevented&&!t.isComposing&&xa(e)})}function xa(t){let e=null;if("form"in t&&(e=t.form),!e&&"getForm"in t&&(e=t.getForm()),!e)return;let o=[...e.elements];if(o.length===1){e.requestSubmit(null);return}let i=o.find(r=>r.type==="submit"&&!r.matches(":disabled"));i&&(["input","button"].includes(i.localName)?e.requestSubmit(i):i.click())}var Wn=C`
  :host {
    border-width: 0;
  }

  :host(:focus) {
    outline: none;
  }

  .text-field {
    display: flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    transition: inherit;
    height: var(--wa-form-control-height);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    cursor: text;
    color: var(--wa-form-control-value-color);
    font-size: var(--wa-form-control-value-font-size);
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    vertical-align: middle;
    width: 100%;
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    background-color: var(--wa-form-control-background-color);
    box-shadow: var(--box-shadow);
    padding: 0 var(--wa-form-control-padding-inline);
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);

    &:focus-within {
      outline-color: var(--wa-color-focus);
    }

    /* Style disabled inputs */
    &:has(:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  /* Appearance modifiers */
  :host([appearance='outlined']) .text-field {
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
  }

  :host([appearance='filled']) .text-field {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-neutral-fill-quiet);
  }

  :host([appearance='filled-outlined']) .text-field {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-form-control-border-color);
  }

  :host([pill]) .text-field {
    border-radius: var(--wa-border-radius-pill) !important;
  }

  .text-field {
    /* Show autofill styles over the entire text field, not just the native <input> */
    &:has(:autofill),
    &:has(:-webkit-autofill) {
      background-color: var(--wa-color-brand-fill-quiet) !important;
    }

    input,
    textarea {
      /*
      Fixes an alignment issue with placeholders.
      https://github.com/shoelace-style/webawesome/issues/342
    */
      height: 100%;

      padding: 0;
      border: none;
      outline: none;
      box-shadow: none;
      margin: 0;
      cursor: inherit;
      -webkit-appearance: none;
      font: inherit;

      /* Turn off Safari's autofill styles */
      &:-webkit-autofill,
      &:-webkit-autofill:hover,
      &:-webkit-autofill:focus,
      &:-webkit-autofill:active {
        -webkit-background-clip: text;
        background-color: transparent;
        -webkit-text-fill-color: inherit;
      }
    }
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    transition: inherit;

    /* prettier-ignore */
    background-color: rgb(118 118 118 / 0); /* ensures proper placeholder styles in webkit's date input */
    height: calc(var(--wa-form-control-height) - var(--border-width) * 2);
    padding-block: 0;
    color: inherit;

    &:autofill {
      &,
      &:hover,
      &:focus,
      &:active {
        box-shadow: none;
        caret-color: var(--wa-form-control-value-color);
      }
    }

    &::placeholder {
      color: var(--wa-form-control-placeholder-color);
      user-select: none;
      -webkit-user-select: none;
    }

    &::-webkit-search-decoration,
    &::-webkit-search-cancel-button,
    &::-webkit-search-results-button,
    &::-webkit-search-results-decoration {
      -webkit-appearance: none;
    }

    &:focus {
      outline: none;
    }
  }

  textarea {
    &:autofill {
      &,
      &:hover,
      &:focus,
      &:active {
        box-shadow: none;
        caret-color: var(--wa-form-control-value-color);
      }
    }

    &::placeholder {
      color: var(--wa-form-control-placeholder-color);
      user-select: none;
      -webkit-user-select: none;
    }
  }

  .start,
  .end {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    cursor: default;

    &::slotted(wa-icon) {
      color: var(--wa-color-neutral-on-quiet);
    }
  }

  .start::slotted(*) {
    margin-inline-end: var(--wa-form-control-padding-inline);
  }

  .end::slotted(*) {
    margin-inline-start: var(--wa-form-control-padding-inline);
  }

  /*
   * Clearable + Password Toggle
   */

  .clear,
  .password-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--wa-color-neutral-on-quiet);
    border: none;
    background: none;
    padding: 0;
    transition: var(--wa-transition-normal) color;
    cursor: pointer;
    margin-inline-start: var(--wa-form-control-padding-inline);

    @media (hover: hover) {
      &:hover {
        color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
      }
    }

    &:active {
      color: color-mix(in oklab, currentColor, var(--wa-color-mix-active));
    }

    &:focus {
      outline: none;
    }
  }

  /* Don't show the browser's password toggle in Edge */
  ::-ms-reveal {
    display: none;
  }

  /* Hide the built-in number spinner */
  :host([without-spin-buttons]) input[type='number'] {
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      display: none;
    }
  }
`;var Y=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["blur","input"],this.hasSlotController=new Z(this,"hint","label"),this.localize=new I(this),this.title="",this.type="text",this._value=null,this.defaultValue=this.getAttribute("value")||null,this.size="m",this.appearance="outlined",this.pill=!1,this.label="",this.hint="",this.withClear=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.withoutSpinButtons=!1,this.required=!1,this.spellcheck=!0,this.withLabel=!1,this.withHint=!1}static get validators(){return[...super.validators,jt()]}get value(){return this.valueHasChanged?this._value:this._value??this.defaultValue}set value(t){this._value!==t&&(this.valueHasChanged=!0,this._value=t)}updateFormValue(t){if(t==null){this.setValue("",null);return}super.updateFormValue(t)}handleSizeChange(){U(this.localName,this.size)}handleChange(t){this.value=this.input.value,this.relayNativeEvent(t,{bubbles:!0,composed:!0})}handleClearClick(t){t.preventDefault(),this.value!==""&&(this.value="",this.updateComplete.then(()=>{this.dispatchEvent(new co),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})),this.input.focus()}handleInput(){this.value=this.input.value}handleKeyDown(t){ho(t,this)}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}updated(t){if(super.updated(t),t.has("value")||t.has("defaultValue")||t.has("type")){let e=["number","date","time","datetime-local"];this.input&&e.includes(this.type)&&this.value&&this.input.value!==this.value&&(this._value=this.input.value),this.customStates.set("blank",!this.value),this.updateValidity()}}handleStepChange(){this.input.step=String(this.step),this.updateValidity()}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(t,e,o="none"){this.input.setSelectionRange(t,e,o)}setRangeText(t,e,o,i="preserve"){let r=e??this.input.selectionStart,s=o??this.input.selectionEnd;this.input.setRangeText(t,r,s,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}formResetCallback(){this.value=null,this.input&&(this.input.value=this.value),super.formResetCallback()}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e,r=this.withClear&&!this.disabled&&!this.readonly,s=(!this.didSSR||this.hasUpdated)&&r&&(typeof this.value=="number"||this.value&&this.value.length>0);return p`
      <label
        part="form-control-label label"
        class=${_({label:!0,"has-label":o})}
        for="input"
        aria-hidden=${o?"false":"true"}
      >
        <slot name="label">${this.label}</slot>
      </label>

      <div part="base input-wrapper" class="text-field">
        <slot name="start" part="start" class="start"></slot>

        <input
          part="input"
          id="input"
          class="control"
          type=${this.type==="password"&&this.passwordVisible?"text":this.type}
          title=${this.title}
          name=${M(this.name)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          placeholder=${M(this.placeholder)}
          minlength=${M(this.minlength)}
          maxlength=${M(this.maxlength)}
          min=${M(this.min)}
          max=${M(this.max)}
          step=${M(this.step)}
          .value=${Mt(this.value??"")}
          autocapitalize=${M(this.autocapitalize)}
          autocomplete=${M(this.autocomplete)}
          autocorrect=${this.autocorrect?"on":"off"}
          ?autofocus=${this.autofocus}
          spellcheck=${this.spellcheck}
          pattern=${M(this.pattern)}
          enterkeyhint=${M(this.enterkeyhint)}
          inputmode=${M(this.inputmode)}
          aria-describedby="hint"
          @change=${this.handleChange}
          @input=${this.handleInput}
          @keydown=${this.handleKeyDown}
        />

        ${s?p`
              <button
                part="clear-button"
                class="clear"
                type="button"
                aria-label=${this.localize.term("clearEntry")}
                @click=${this.handleClearClick}
                tabindex="-1"
              >
                <slot name="clear-icon">
                  <wa-icon name="circle-xmark" library="system" variant="regular"></wa-icon>
                </slot>
              </button>
            `:""}
        ${this.passwordToggle&&!this.disabled?p`
              <button
                part="password-toggle-button"
                class="password-toggle"
                type="button"
                aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                @click=${this.handlePasswordToggle}
                tabindex="-1"
              >
                ${this.passwordVisible?p`
                      <slot name="hide-password-icon">
                        <wa-icon name="eye-slash" library="system" variant="regular"></wa-icon>
                      </slot>
                    `:p`
                      <slot name="show-password-icon">
                        <wa-icon name="eye" library="system" variant="regular"></wa-icon>
                      </slot>
                    `}
              </button>
            `:""}

        <slot name="end" part="end" class="end"></slot>
      </div>

      <slot
        id="hint"
        part="hint"
        name="hint"
        class=${_({"has-slotted":i})}
        aria-hidden=${i?"false":"true"}
        >${this.hint}</slot
      >
    `}};Y.css=[j,pt,Wn];Y.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S("input")],Y.prototype,"input",2);a([l()],Y.prototype,"title",2);a([l({reflect:!0})],Y.prototype,"type",2);a([A()],Y.prototype,"value",1);a([l({attribute:"value",reflect:!0})],Y.prototype,"defaultValue",2);a([l({reflect:!0})],Y.prototype,"size",2);a([y("size")],Y.prototype,"handleSizeChange",1);a([l({reflect:!0})],Y.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],Y.prototype,"pill",2);a([l()],Y.prototype,"label",2);a([l({attribute:"hint"})],Y.prototype,"hint",2);a([l({attribute:"with-clear",type:Boolean})],Y.prototype,"withClear",2);a([l()],Y.prototype,"placeholder",2);a([l({type:Boolean,reflect:!0})],Y.prototype,"readonly",2);a([l({attribute:"password-toggle",type:Boolean})],Y.prototype,"passwordToggle",2);a([l({attribute:"password-visible",type:Boolean})],Y.prototype,"passwordVisible",2);a([l({attribute:"without-spin-buttons",type:Boolean,reflect:!0})],Y.prototype,"withoutSpinButtons",2);a([l({type:Boolean,reflect:!0})],Y.prototype,"required",2);a([l()],Y.prototype,"pattern",2);a([l({type:Number})],Y.prototype,"minlength",2);a([l({type:Number})],Y.prototype,"maxlength",2);a([l()],Y.prototype,"min",2);a([l()],Y.prototype,"max",2);a([l()],Y.prototype,"step",2);a([l()],Y.prototype,"autocapitalize",2);a([l({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="off"),toAttribute:t=>t?"on":"off"}})],Y.prototype,"autocorrect",2);a([l()],Y.prototype,"autocomplete",2);a([l({type:Boolean})],Y.prototype,"autofocus",2);a([l()],Y.prototype,"enterkeyhint",2);a([l({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="false"),toAttribute:t=>t?"true":"false"}})],Y.prototype,"spellcheck",2);a([l()],Y.prototype,"inputmode",2);a([l({attribute:"with-label",type:Boolean})],Y.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],Y.prototype,"withHint",2);a([y("step",{waitUntilFirstUpdate:!0})],Y.prototype,"handleStepChange",1);Y=a([k("wa-input")],Y);Y.disableWarning?.("change-in-update");var hr=class extends Event{constructor(){super("wa-reposition",{bubbles:!0,cancelable:!1,composed:!0})}};var Nn=C`
  :host {
    --arrow-color: black;
    --arrow-size: var(--wa-tooltip-arrow-size);
    --popup-border-width: 0px;
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);

    /*
     * These properties are computed to account for the arrow's dimensions after being rotated 45º. The constant
     * 0.7071 is derived from sin(45) to calculate the length of the arrow after rotation.
     *
     * The diamond will be translated inward by --arrow-base-offset, the border thickness, to centralise it on
     * the inner edge of the popup border. This also means we need to increase the size of the arrow by the
     * same amount to compensate.
     *
     * A diamond shaped clipping mask is used to avoid overlap of popup content. This extends slightly inward so
     * the popup border is covered with no sub-pixel rounding artifacts. The diamond corners are mitred at 22.5º
     * to properly merge any arrow border with the popup border. The constant 1.4142 is derived from 1 + tan(22.5).
     *
     */
    --arrow-base-offset: var(--popup-border-width);
    --arrow-size-diagonal: calc((var(--arrow-size) + var(--arrow-base-offset)) * 0.7071);
    --arrow-padding-offset: calc(var(--arrow-size-diagonal) - var(--arrow-size));
    --arrow-size-div: calc(var(--arrow-size-diagonal) * 2);
    --arrow-clipping-corner: calc(var(--arrow-base-offset) * 1.4142);

    display: contents;
  }

  .popup {
    position: absolute;
    isolation: isolate;
    max-width: var(--auto-size-available-width, none);
    max-height: var(--auto-size-available-height, none);

    /* Clear UA styles for [popover] */
    :where(&) {
      inset: unset;
      padding: unset;
      margin: unset;
      width: unset;
      height: unset;
      color: unset;
      background: unset;
      border: unset;
      overflow: unset;
    }
  }

  .popup-fixed {
    position: fixed;
  }

  .popup:not(.popup-active) {
    display: none;
  }

  .arrow {
    position: absolute;
    width: var(--arrow-size-div);
    height: var(--arrow-size-div);
    background: var(--arrow-color);
    z-index: 3;
    clip-path: polygon(
      var(--arrow-clipping-corner) 100%,
      var(--arrow-base-offset) calc(100% - var(--arrow-base-offset)),
      calc(var(--arrow-base-offset) - 2px) calc(100% - var(--arrow-base-offset)),
      calc(100% - var(--arrow-base-offset)) calc(var(--arrow-base-offset) - 2px),
      calc(100% - var(--arrow-base-offset)) var(--arrow-base-offset),
      100% var(--arrow-clipping-corner),
      100% 100%
    );
    rotate: 45deg;
  }

  :host([data-current-placement|='left']) .arrow {
    rotate: -45deg;
  }

  :host([data-current-placement|='right']) .arrow {
    rotate: 135deg;
  }

  :host([data-current-placement|='bottom']) .arrow {
    rotate: 225deg;
  }

  /* Hover bridge */
  .popup-hover-bridge:not(.popup-hover-bridge-visible) {
    display: none;
  }

  .popup-hover-bridge {
    position: fixed;
    z-index: 899;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--hover-bridge-top-left-x, 0) var(--hover-bridge-top-left-y, 0),
      var(--hover-bridge-top-right-x, 0) var(--hover-bridge-top-right-y, 0),
      var(--hover-bridge-bottom-right-x, 0) var(--hover-bridge-bottom-right-y, 0),
      var(--hover-bridge-bottom-left-x, 0) var(--hover-bridge-bottom-left-y, 0)
    );
  }

  /* Built-in animations */
  .show {
    animation: show var(--show-duration) ease;
  }

  .hide {
    animation: show var(--hide-duration) ease reverse;
  }

  @keyframes show {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .show-with-scale {
    animation: show-with-scale var(--show-duration) ease;
  }

  .hide-with-scale {
    animation: show-with-scale var(--hide-duration) ease reverse;
  }

  @keyframes show-with-scale {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
`;var Oe=Math.min,ze=Math.max,xi=Math.round,Ci=Math.floor,Be=t=>({x:t,y:t}),Vp={left:"right",right:"left",bottom:"top",top:"bottom"};function Ca(t,e,o){return ze(t,Oe(e,o))}function Mo(t,e){return typeof t=="function"?t(e):t}function po(t){return t.split("-")[0]}function Io(t){return t.split("-")[1]}function ka(t){return t==="x"?"y":"x"}function pr(t){return t==="y"?"height":"width"}function Fe(t){let e=t[0];return e==="t"||e==="b"?"y":"x"}function ur(t){return ka(Fe(t))}function jn(t,e,o){o===void 0&&(o=!1);let i=Io(t),r=ur(t),s=pr(r),n=r==="x"?i===(o?"end":"start")?"right":"left":i==="start"?"bottom":"top";return e.reference[s]>e.floating[s]&&(n=yi(n)),[n,yi(n)]}function Kn(t){let e=yi(t);return[dr(t),e,dr(e)]}function dr(t){return t.includes("start")?t.replace("start","end"):t.replace("end","start")}var Hn=["left","right"],Un=["right","left"],qp=["top","bottom"],Wp=["bottom","top"];function Np(t,e,o){switch(t){case"top":case"bottom":return o?e?Un:Hn:e?Hn:Un;case"left":case"right":return e?qp:Wp;default:return[]}}function Xn(t,e,o,i){let r=Io(t),s=Np(po(t),o==="start",i);return r&&(s=s.map(n=>n+"-"+r),e&&(s=s.concat(s.map(dr)))),s}function yi(t){let e=po(t);return Vp[e]+t.slice(e.length)}function Hp(t){var e,o,i,r;return{top:(e=t.top)!=null?e:0,right:(o=t.right)!=null?o:0,bottom:(i=t.bottom)!=null?i:0,left:(r=t.left)!=null?r:0}}function Sa(t){return typeof t!="number"?Hp(t):{top:t,right:t,bottom:t,left:t}}function Do(t){let{x:e,y:o,width:i,height:r}=t;return{width:i,height:r,top:o,left:e,right:e+i,bottom:o+r,x:e,y:o}}function Yn(t,e,o){let{reference:i,floating:r}=t,s=Fe(e),n=ur(e),c=pr(n),h=po(e),d=s==="y",u=i.x+i.width/2-r.width/2,b=i.y+i.height/2-r.height/2,f=i[c]/2-r[c]/2,g;switch(h){case"top":g={x:u,y:i.y-r.height};break;case"bottom":g={x:u,y:i.y+i.height};break;case"right":g={x:i.x+i.width,y:b};break;case"left":g={x:i.x-r.width,y:b};break;default:g={x:i.x,y:i.y}}let v=Io(e);return v&&(g[n]+=f*(v==="end"?1:-1)*(o&&d?-1:1)),g}async function Gn(t,e){var o;e===void 0&&(e={});let{x:i,y:r,platform:s,rects:n,elements:c,strategy:h}=t,{boundary:d="clippingAncestors",rootBoundary:u="viewport",elementContext:b="floating",altBoundary:f=!1,padding:g=0}=Mo(e,t),v=Sa(g),z=c[f?b==="floating"?"reference":"floating":b],w=Do(await s.getClippingRect({element:(o=await(s.isElement==null?void 0:s.isElement(z)))==null||o?z:z.contextElement||await(s.getDocumentElement==null?void 0:s.getDocumentElement(c.floating)),boundary:d,rootBoundary:u,strategy:h})),x=b==="floating"?{x:i,y:r,width:n.floating.width,height:n.floating.height}:n.reference,$=await(s.getOffsetParent==null?void 0:s.getOffsetParent(c.floating)),L=await(s.isElement==null?void 0:s.isElement($))&&await(s.getScale==null?void 0:s.getScale($))||{x:1,y:1},T=Do(s.convertOffsetParentRelativeRectToViewportRelativeRect?await s.convertOffsetParentRelativeRectToViewportRelativeRect({elements:c,rect:x,offsetParent:$,strategy:h}):x);return{top:(w.top-T.top+v.top)/L.y,bottom:(T.bottom-w.bottom+v.bottom)/L.y,left:(w.left-T.left+v.left)/L.x,right:(T.right-w.right+v.right)/L.x}}var Up=50,Zn=async(t,e,o)=>{let{placement:i="bottom",strategy:r="absolute",middleware:s=[],platform:n}=o,c=n.detectOverflow?n:{...n,detectOverflow:Gn},h=await(n.isRTL==null?void 0:n.isRTL(e)),d=await n.getElementRects({reference:t,floating:e,strategy:r}),{x:u,y:b}=Yn(d,i,h),f=i,g=0,v={};for(let m=0;m<s.length;m++){let z=s[m];if(!z)continue;let{name:w,fn:x}=z,{x:$,y:L,data:T,reset:F}=await x({x:u,y:b,initialPlacement:i,placement:f,strategy:r,middlewareData:v,rects:d,platform:c,elements:{reference:t,floating:e}});u=$??u,b=L??b,v[w]={...v[w],...T},F&&g<Up&&(g++,typeof F=="object"&&(F.placement&&(f=F.placement),F.rects&&(d=F.rects===!0?await n.getElementRects({reference:t,floating:e,strategy:r}):F.rects),{x:u,y:b}=Yn(d,f,h)),m=-1)}return{x:u,y:b,placement:f,strategy:r,middlewareData:v}},Qn=t=>({name:"arrow",options:t,async fn(e){let{x:o,y:i,placement:r,rects:s,platform:n,elements:c,middlewareData:h}=e,{element:d,padding:u=0}=Mo(t,e)||{};if(d==null)return{};let b=Sa(u),f={x:o,y:i},g=ur(r),v=pr(g),m=await n.getDimensions(d),z=g==="y",w=z?"top":"left",x=z?"bottom":"right",$=z?"clientHeight":"clientWidth",L=s.reference[v]+s.reference[g]-f[g]-s.floating[v],T=f[g]-s.reference[g],F=await(n.getOffsetParent==null?void 0:n.getOffsetParent(d)),K=F?F[$]:0;(!K||!await(n.isElement==null?void 0:n.isElement(F)))&&(K=c.floating[$]||s.floating[v]);let H=L/2-T/2,nt=K/2-m[v]/2-1,it=Oe(b[w],nt),yt=Oe(b[x],nt),wt=K-m[v]-yt,Lt=K/2-m[v]/2+H,zt=Ca(it,Lt,wt),ae=!h.arrow&&Io(r)!=null&&Lt!==zt&&s.reference[v]/2-(Lt<it?it:yt)-m[v]/2<0,P=ae?Lt<it?Lt-it:Lt-wt:0;return{[g]:f[g]+P,data:{[g]:zt,centerOffset:Lt-zt-P,...ae&&{alignmentOffset:P}},reset:ae}}});var Jn=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var o,i;let{placement:r,middlewareData:s,rects:n,initialPlacement:c,platform:h,elements:d}=e,{mainAxis:u=!0,crossAxis:b=!0,fallbackPlacements:f,fallbackStrategy:g="bestFit",fallbackAxisSideDirection:v="none",flipAlignment:m=!0,...z}=Mo(t,e);if((o=s.arrow)!=null&&o.alignmentOffset)return{};let w=po(r),x=Fe(c),$=po(c)===c,L=await(h.isRTL==null?void 0:h.isRTL(d.floating)),T=f||($||!m?[yi(c)]:Kn(c)),F=v!=="none";!f&&F&&T.push(...Xn(c,m,v,L));let K=[c,...T],H=await h.detectOverflow(e,z),nt=[],it=((i=s.flip)==null?void 0:i.overflows)||[];if(u&&nt.push(H[w]),b){let zt=jn(r,n,L);nt.push(H[zt[0]],H[zt[1]])}if(it=[...it,{placement:r,overflows:nt}],!nt.every(zt=>zt<=0)){var yt,wt;let zt=(((yt=s.flip)==null?void 0:yt.index)||0)+1,ae=K[zt];if(ae&&(!(b==="alignment"?x!==Fe(ae):!1)||it.every(D=>Fe(D.placement)===x?D.overflows[0]>0:!0)))return{data:{index:zt,overflows:it},reset:{placement:ae}};let P=(wt=it.filter(O=>O.overflows[0]<=0).sort((O,D)=>O.overflows[1]-D.overflows[1])[0])==null?void 0:wt.placement;if(!P)switch(g){case"bestFit":{var Lt;let O=(Lt=it.filter(D=>{if(F){let B=Fe(D.placement);return B===x||B==="y"}return!0}).map(D=>[D.placement,D.overflows.filter(B=>B>0).reduce((B,V)=>B+V,0)]).sort((D,B)=>D[1]-B[1])[0])==null?void 0:Lt[0];O&&(P=O);break}case"initialPlacement":P=c;break}if(r!==P)return{reset:{placement:P}}}return{}}}};var jp=new Set(["left","top"]);async function Kp(t,e){let{placement:o,platform:i,elements:r}=t,s=await(i.isRTL==null?void 0:i.isRTL(r.floating)),n=po(o),c=Io(o),h=Fe(o)==="y",d=jp.has(n)?-1:1,u=s&&h?-1:1,b=Mo(e,t),{mainAxis:f,crossAxis:g,alignmentAxis:v}=typeof b=="number"?{mainAxis:b,crossAxis:0,alignmentAxis:null}:{mainAxis:b.mainAxis||0,crossAxis:b.crossAxis||0,alignmentAxis:b.alignmentAxis};return c&&typeof v=="number"&&(g=c==="end"?v*-1:v),h?{x:g*u,y:f*d}:{x:f*d,y:g*u}}var tl=function(t){return t===void 0&&(t=0),{name:"offset",options:t,async fn(e){var o,i;let{x:r,y:s,placement:n,middlewareData:c}=e,h=await Kp(e,t);return n===((o=c.offset)==null?void 0:o.placement)&&(i=c.arrow)!=null&&i.alignmentOffset?{}:{x:r+h.x,y:s+h.y,data:{...h,placement:n}}}}},el=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){let{x:o,y:i,placement:r,platform:s}=e,{mainAxis:n=!0,crossAxis:c=!1,limiter:h={fn:x=>{let{x:$,y:L}=x;return{x:$,y:L}}},...d}=Mo(t,e),u={x:o,y:i},b=await s.detectOverflow(e,d),f=Fe(r),g=ka(f),v=u[g],m=u[f],z=(x,$)=>Ca($+b[x==="y"?"top":"left"],$,$-b[x==="y"?"bottom":"right"]);n&&(v=z(g,v)),c&&(m=z(f,m));let w=h.fn({...e,[g]:v,[f]:m});return{...w,data:{x:w.x-o,y:w.y-i,enabled:{[g]:n,[f]:c}}}}}};var ol=function(t){return t===void 0&&(t={}),{name:"size",options:t,async fn(e){let{placement:o,rects:i,platform:r,elements:s}=e,{apply:n=()=>{},...c}=Mo(t,e),h=await r.detectOverflow(e,c),d=po(o),u=Io(o),b=Fe(o)==="y",{width:f,height:g}=i.floating,v,m;d==="top"||d==="bottom"?(v=d,m=u===(await(r.isRTL==null?void 0:r.isRTL(s.floating))?"start":"end")?"left":"right"):(m=d,v=u==="end"?"top":"bottom");let z=g-h.top-h.bottom,w=f-h.left-h.right,x=Oe(g-h[v],z),$=Oe(f-h[m],w),L=e.middlewareData.shift,T=!L,F=x,K=$;L!=null&&L.enabled.x&&(K=w),L!=null&&L.enabled.y&&(F=z),T&&!u&&(b?K=f-2*ze(h.left,h.right):F=g-2*ze(h.top,h.bottom)),await n({...e,availableWidth:K,availableHeight:F});let H=await r.getDimensions(s.floating);return f!==H.width||g!==H.height?{reset:{rects:!0}}:{}}}};function mr(){return typeof window<"u"}function Po(t){return rl(t)?(t.nodeName||"").toLowerCase():"#document"}function Qt(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function Ve(t){var e;return(e=(rl(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function rl(t){return mr()?t instanceof Node||t instanceof Qt(t).Node:!1}function Ee(t){return mr()?t instanceof Element||t instanceof Qt(t).Element:!1}function Ze(t){return mr()?t instanceof HTMLElement||t instanceof Qt(t).HTMLElement:!1}function il(t){return!mr()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof Qt(t).ShadowRoot}function ki(t){let{overflow:e,overflowX:o,overflowY:i,display:r}=Le(t);return/auto|scroll|overlay|hidden|clip/.test(e+i+o)&&r!=="inline"&&r!=="contents"}function al(t){return/^(table|td|th)$/.test(Po(t))}function Si(t){try{if(t.matches(":popover-open"))return!0}catch{}try{return t.matches(":modal")}catch{return!1}}var Xp=/transform|translate|scale|rotate|perspective|filter/,Yp=/paint|layout|strict|content/,Ro=t=>!!t&&t!=="none",za;function Xo(t){let e=Ee(t)?Le(t):t;return Ro(e.transform)||Ro(e.translate)||Ro(e.scale)||Ro(e.rotate)||Ro(e.perspective)||!fr()&&(Ro(e.backdropFilter)||Ro(e.filter))||Xp.test(e.willChange||"")||Yp.test(e.contain||"")}function sl(t){let e=uo(t);for(;Ze(e)&&!Yo(e);){if(Xo(e))return e;if(Si(e))return null;e=uo(e)}return null}function fr(){return za==null&&(za=typeof CSS<"u"&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),za}function Yo(t){return/^(html|body|#document)$/.test(Po(t))}function Le(t){return Qt(t).getComputedStyle(t)}function zi(t){return Ee(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function uo(t){if(Po(t)==="html")return t;let e=t.assignedSlot||t.parentNode||il(t)&&t.host||Ve(t);return il(e)?e.host:e}function nl(t){let e=uo(t);return Yo(e)?(t.ownerDocument||t).body:Ze(e)&&ki(e)?e:nl(e)}function Ge(t,e,o){var i;e===void 0&&(e=[]),o===void 0&&(o=!0);let r=nl(t),s=r===((i=t.ownerDocument)==null?void 0:i.body),n=Qt(r);if(s){let c=gr(n);return e.concat(n,n.visualViewport||[],ki(r)?r:[],c&&o?Ge(c):[])}else return e.concat(r,Ge(r,[],o))}function gr(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function hl(t){let e=Le(t),o=parseFloat(e.width)||0,i=parseFloat(e.height)||0,r=Ze(t),s=r?t.offsetWidth:o,n=r?t.offsetHeight:i,c=xi(o)!==s||xi(i)!==n;return c&&(o=s,i=n),{width:o,height:i,$:c}}function La(t){return Ee(t)?t:t.contextElement}function Go(t){let e=La(t);if(!Ze(e))return Be(1);let o=e.getBoundingClientRect(),{width:i,height:r,$:s}=hl(e),n=(s?xi(o.width):o.width)/i,c=(s?xi(o.height):o.height)/r;return(!n||!Number.isFinite(n))&&(n=1),(!c||!Number.isFinite(c))&&(c=1),{x:n,y:c}}var Gp=Be(0);function dl(t){let e=Qt(t);return!fr()||!e.visualViewport?Gp:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function Zp(t,e,o){return e===void 0&&(e=!1),!!o&&e&&o===Qt(t)}function Oo(t,e,o,i){e===void 0&&(e=!1),o===void 0&&(o=!1);let r=t.getBoundingClientRect(),s=La(t),n=Be(1);e&&(i?Ee(i)&&(n=Go(i)):n=Go(t));let c=Zp(s,o,i)?dl(s):Be(0),h=(r.left+c.x)/n.x,d=(r.top+c.y)/n.y,u=r.width/n.x,b=r.height/n.y;if(s&&i){let f=Qt(s),g=Ee(i)?Qt(i):i,v=f,m=gr(v);for(;m&&g!==v;){let z=Go(m),w=m.getBoundingClientRect(),x=Le(m),$=w.left+(m.clientLeft+parseFloat(x.paddingLeft))*z.x,L=w.top+(m.clientTop+parseFloat(x.paddingTop))*z.y;h*=z.x,d*=z.y,u*=z.x,b*=z.y,h+=$,d+=L,v=Qt(m),m=gr(v)}}return Do({width:u,height:b,x:h,y:d})}function br(t,e){let o=zi(t).scrollLeft;return e?e.left+o:Oo(Ve(t)).left+o}function pl(t,e){let o=t.getBoundingClientRect(),i=o.left+e.scrollLeft-br(t,o),r=o.top+e.scrollTop;return{x:i,y:r}}function Qp(t){let{elements:e,rect:o,offsetParent:i,strategy:r}=t,s=r==="fixed",n=Ve(i),c=e?Si(e.floating):!1;if(i===n||c&&s)return o;let h={scrollLeft:0,scrollTop:0},d=Be(1),u=Be(0),b=Ze(i);if((b||!s)&&((Po(i)!=="body"||ki(n))&&(h=zi(i)),b)){let g=Oo(i);d=Go(i),u.x=g.x+i.clientLeft,u.y=g.y+i.clientTop}let f=n&&!b&&!s?pl(n,h):Be(0);return{width:o.width*d.x,height:o.height*d.y,x:o.x*d.x-h.scrollLeft*d.x+u.x+f.x,y:o.y*d.y-h.scrollTop*d.y+u.y+f.y}}function Jp(t){return t.getClientRects?Array.from(t.getClientRects()):[]}function tu(t){let e=zi(t),o=t.ownerDocument.body,i=ze(t.scrollWidth,t.clientWidth,o.scrollWidth,o.clientWidth),r=ze(t.scrollHeight,t.clientHeight,o.scrollHeight,o.clientHeight),s=-e.scrollLeft+br(t),n=-e.scrollTop;return Le(o).direction==="rtl"&&(s+=ze(t.clientWidth,o.clientWidth)-i),{width:i,height:r,x:s,y:n}}var eu=25;function ou(t,e,o){o===void 0&&(o="viewport");let i=o==="layoutViewport",r=Qt(t),s=Ve(t),n=r.visualViewport,c=s.clientWidth,h=s.clientHeight,d=0,u=0;if(n){let f=!fr()||e==="fixed";i?f||(d=-n.offsetLeft,u=-n.offsetTop):(c=n.width,h=n.height,f&&(d=n.offsetLeft,u=n.offsetTop))}if(br(s)<=0){let f=s.ownerDocument,g=f.body,v=getComputedStyle(g),m=f.compatMode==="CSS1Compat"&&parseFloat(v.marginLeft)+parseFloat(v.marginRight)||0,z=Math.abs(s.clientWidth-g.clientWidth-m),w=getComputedStyle(s).scrollbarGutter==="stable both-edges"?z/2:z;w<=eu&&(c-=w)}return{width:c,height:h,x:d,y:u}}function iu(t,e){let o=Oo(t,!0,e==="fixed"),i=o.top+t.clientTop,r=o.left+t.clientLeft,s=Go(t),n=t.clientWidth*s.x,c=t.clientHeight*s.y,h=r*s.x,d=i*s.y;return{width:n,height:c,x:h,y:d}}function ll(t,e,o){let i;if(e==="viewport"||e==="layoutViewport")i=ou(t,o,e);else if(e==="document")i=tu(Ve(t));else if(Ee(e))i=iu(e,o);else{let r=dl(t);i={x:e.x-r.x,y:e.y-r.y,width:e.width,height:e.height}}return Do(i)}function ru(t,e){let o=e.get(t);if(o)return o;let i=Ge(t,[],!1).filter(c=>Ee(c)&&Po(c)!=="body"),r=null,s=Le(t).position==="fixed",n=s?uo(t):t;for(;Ee(n)&&!Yo(n);){let c=Le(n),h=Xo(n),d=r?r.position:s?"fixed":"";!h&&(d==="fixed"||d==="absolute"&&c.position==="static")?i=i.filter(b=>b!==n):r=c,n=uo(n)}return e.set(t,i),i}function au(t){let{element:e,boundary:o,rootBoundary:i,strategy:r}=t,n=[...o==="clippingAncestors"?Si(e)?[]:ru(e,this._c):[].concat(o),i],c=ll(e,n[0],r),h=c.top,d=c.right,u=c.bottom,b=c.left;for(let f=1;f<n.length;f++){let g=ll(e,n[f],r);h=ze(g.top,h),d=Oe(g.right,d),u=Oe(g.bottom,u),b=ze(g.left,b)}return{width:d-b,height:u-h,x:b,y:h}}function su(t){let{width:e,height:o}=hl(t);return{width:e,height:o}}function nu(t,e,o){let i=Ze(e),r=Ve(e),s=o==="fixed",n=Oo(t,!0,s,e),c={scrollLeft:0,scrollTop:0},h=Be(0);if((i||!s)&&((Po(e)!=="body"||ki(r))&&(c=zi(e)),i)){let f=Oo(e,!0,s,e);h.x=f.x+e.clientLeft,h.y=f.y+e.clientTop}!i&&r&&(h.x=br(r));let d=r&&!i&&!s?pl(r,c):Be(0),u=n.left+c.scrollLeft-h.x-d.x,b=n.top+c.scrollTop-h.y-d.y;return{x:u,y:b,width:n.width,height:n.height}}function Ea(t){return Le(t).position==="static"}function cl(t,e){if(!Ze(t)||Le(t).position==="fixed")return null;if(e)return e(t);let o=t.offsetParent;return Ve(t)===o&&(o=o.ownerDocument.body),o}function ul(t,e){let o=Qt(t);if(Si(t))return o;if(!Ze(t)){let r=uo(t);for(;r&&!Yo(r);){if(Ee(r)&&!Ea(r))return r;r=uo(r)}return o}let i=cl(t,e);for(;i&&al(i)&&Ea(i);)i=cl(i,e);return i&&Yo(i)&&Ea(i)&&!Xo(i)?o:i||sl(t)||o}var lu=async function(t){let e=this.getOffsetParent||ul,o=this.getDimensions,i=await o(t.floating);return{reference:nu(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,width:i.width,height:i.height}}};function cu(t){return Le(t).direction==="rtl"}var Ei={convertOffsetParentRelativeRectToViewportRelativeRect:Qp,getDocumentElement:Ve,getClippingRect:au,getOffsetParent:ul,getElementRects:lu,getClientRects:Jp,getDimensions:su,getScale:Go,isElement:Ee,isRTL:cu};function ml(t,e){return t.x===e.x&&t.y===e.y&&t.width===e.width&&t.height===e.height}function hu(t,e,o){let i=null,r,s=Ve(t);function n(){var u;clearTimeout(r),(u=i)==null||u.disconnect(),i=null}function c(u,b){u===void 0&&(u=!1),b===void 0&&(b=1),n();let f=t.getBoundingClientRect(),{left:g,top:v,width:m,height:z}=f;if(u||e(),!m||!z)return;let w=Ci(v),x=Ci(s.clientWidth-(g+m)),$=Ci(s.clientHeight-(v+z)),L=Ci(g),F={rootMargin:-w+"px "+-x+"px "+-$+"px "+-L+"px",threshold:ze(0,Oe(1,b))||1},K=!0;function H(nt){let it=nt[0].intersectionRatio;if(!ml(f,t.getBoundingClientRect()))return c();if(it!==b){if(!K)return c();it?c(!1,it):r=setTimeout(()=>{c(!1,1e-7)},1e3)}K=!1}try{i=new IntersectionObserver(H,{...F,root:s.ownerDocument})}catch{i=new IntersectionObserver(H,F)}i.observe(t)}let h=Qt(t),d=()=>c(o);return h.addEventListener("resize",d),c(!0),()=>{h.removeEventListener("resize",d),n()}}function vr(t,e,o,i){i===void 0&&(i={});let{ancestorScroll:r=!0,ancestorResize:s=!0,elementResize:n=typeof ResizeObserver=="function",layoutShift:c=typeof IntersectionObserver=="function",animationFrame:h=!1}=i,d=La(t),u=r||s?[...d?Ge(d):[],...e?Ge(e):[]]:[];u.forEach(w=>{r&&w.addEventListener("scroll",o),s&&w.addEventListener("resize",o)});let b=d&&c?hu(d,o,s):null,f=-1,g=null;n&&(g=new ResizeObserver(w=>{let[x]=w;x&&x.target===d&&g&&e&&(g.unobserve(e),cancelAnimationFrame(f),f=requestAnimationFrame(()=>{var $;($=g)==null||$.observe(e)})),o()}),d&&!h&&g.observe(d),e&&g.observe(e));let v,m=h?Oo(t):null;h&&z();function z(){let w=Oo(t);m&&!ml(m,w)&&o(),m=w,v=requestAnimationFrame(z)}return o(),()=>{var w;u.forEach(x=>{r&&x.removeEventListener("scroll",o),s&&x.removeEventListener("resize",o)}),b?.(),(w=g)==null||w.disconnect(),g=null,h&&cancelAnimationFrame(v)}}var wr=tl;var yr=el,xr=Jn,$a=ol;var fl=Qn;var Cr=(t,e,o)=>{let i=new Map,r=o??{},s={...Ei,...r.platform,_c:i};return Zn(t,e,{...r,platform:s})};function gl(t){return du(t)}function Aa(t){return t.assignedSlot?t.assignedSlot:t.parentNode instanceof ShadowRoot?t.parentNode.host:t.parentNode}function du(t){for(let e=t;e;e=Aa(e))if(e instanceof Element&&getComputedStyle(e).display==="none")return null;for(let e=Aa(t);e;e=Aa(e)){if(!(e instanceof Element))continue;let o=getComputedStyle(e);if(o.display!=="contents"&&(o.position!=="static"||Xo(o)||e.tagName==="BODY"))return e}return null}function bl(t){return t!==null&&typeof t=="object"&&"getBoundingClientRect"in t&&("contextElement"in t?t instanceof Element:!0)}var pu=!!globalThis?.HTMLElement?.prototype.hasOwnProperty("popover"),st=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.SUPPORTS_POPOVER=!1,this.active=!1,this.placement="top",this.boundary="viewport",this.distance=0,this.skidding=0,this.arrow=!1,this.arrowPlacement="anchor",this.arrowPadding=10,this.flip=!1,this.flipFallbackPlacements="",this.flipFallbackStrategy="best-fit",this.flipPadding=0,this.shift=!1,this.shiftPadding=0,this.autoSizePadding=0,this.hoverBridge=!1,this.updateHoverBridge=()=>{if(this.hoverBridge&&this.anchorEl&&this.popup){let t=this.anchorEl.getBoundingClientRect(),e=this.popup.getBoundingClientRect(),o=this.placement.includes("top")||this.placement.includes("bottom"),i=0,r=0,s=0,n=0,c=0,h=0,d=0,u=0;o?t.top<e.top?(i=t.left,r=t.bottom,s=t.right,n=t.bottom,c=e.left,h=e.top,d=e.right,u=e.top):(i=e.left,r=e.bottom,s=e.right,n=e.bottom,c=t.left,h=t.top,d=t.right,u=t.top):t.left<e.left?(i=t.right,r=t.top,s=e.left,n=e.top,c=t.right,h=t.bottom,d=e.left,u=e.bottom):(i=e.right,r=e.top,s=t.left,n=t.top,c=e.right,h=e.bottom,d=t.left,u=t.bottom),this.style.setProperty("--hover-bridge-top-left-x",`${i}px`),this.style.setProperty("--hover-bridge-top-left-y",`${r}px`),this.style.setProperty("--hover-bridge-top-right-x",`${s}px`),this.style.setProperty("--hover-bridge-top-right-y",`${n}px`),this.style.setProperty("--hover-bridge-bottom-left-x",`${c}px`),this.style.setProperty("--hover-bridge-bottom-left-y",`${h}px`),this.style.setProperty("--hover-bridge-bottom-right-x",`${d}px`),this.style.setProperty("--hover-bridge-bottom-right-y",`${u}px`)}}}async connectedCallback(){super.connectedCallback(),await this.updateComplete,this.SUPPORTS_POPOVER=pu,this.start()}disconnectedCallback(){super.disconnectedCallback(),this.stop()}async updated(t){super.updated(t),t.has("active")&&(this.active?this.start():this.stop()),t.has("anchor")&&this.handleAnchorChange(),this.active&&(await this.updateComplete,this.reposition())}async handleAnchorChange(){if(await this.stop(),this.anchor&&typeof this.anchor=="string"){let t=this.getRootNode();this.anchorEl=t.getElementById(this.anchor)}else this.anchor instanceof Element||bl(this.anchor)?this.anchorEl=this.anchor:this.anchorEl=this.querySelector('[slot="anchor"]');this.anchorEl instanceof HTMLSlotElement&&(this.anchorEl=this.anchorEl.assignedElements({flatten:!0})[0]),this.anchorEl&&this.start()}start(){!this.anchorEl||!this.active||!this.isConnected||(this.popup?.showPopover?.(),this.cleanup=vr(this.anchorEl,this.popup,()=>{this.reposition()}))}async stop(){return new Promise(t=>{this.popup?.hidePopover?.(),this.cleanup?(this.cleanup(),this.cleanup=void 0,this.removeAttribute("data-current-placement"),this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height"),requestAnimationFrame(()=>t())):t()})}reposition(){if(!this.active||!this.anchorEl||!this.popup)return;let t=[wr({mainAxis:this.distance,crossAxis:this.skidding})];this.sync?t.push($a({apply:({rects:i})=>{let r=this.sync==="width"||this.sync==="both",s=this.sync==="height"||this.sync==="both";this.popup.style.width=r?`${i.reference.width}px`:"",this.popup.style.height=s?`${i.reference.height}px`:""}})):(this.popup.style.width="",this.popup.style.height="");let e;this.SUPPORTS_POPOVER&&!bl(this.anchor)&&this.boundary==="scroll"&&(e=Ge(this.anchorEl).filter(i=>i instanceof Element)),this.flip&&t.push(xr({boundary:this.flipBoundary||e,fallbackPlacements:this.flipFallbackPlacements,fallbackStrategy:this.flipFallbackStrategy==="best-fit"?"bestFit":"initialPlacement",padding:this.flipPadding})),this.shift&&t.push(yr({boundary:this.shiftBoundary||e,padding:this.shiftPadding})),this.autoSize?t.push($a({boundary:this.autoSizeBoundary||e,padding:this.autoSizePadding,apply:({availableWidth:i,availableHeight:r})=>{this.autoSize==="vertical"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-height",`${r}px`):this.style.removeProperty("--auto-size-available-height"),this.autoSize==="horizontal"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-width",`${i}px`):this.style.removeProperty("--auto-size-available-width")}})):(this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height")),this.arrow&&t.push(fl({element:this.arrowEl,padding:this.arrowPadding}));let o=this.SUPPORTS_POPOVER?i=>Ei.getOffsetParent(i,gl):Ei.getOffsetParent;Cr(this.anchorEl,this.popup,{placement:this.placement,middleware:t,strategy:this.SUPPORTS_POPOVER?"absolute":"fixed",platform:{...Ei,getOffsetParent:o}}).then(({x:i,y:r,middlewareData:s,placement:n})=>{let c=this.localize.dir()==="rtl",h={top:"bottom",right:"left",bottom:"top",left:"right"}[n.split("-")[0]];if(this.setAttribute("data-current-placement",n),Object.assign(this.popup.style,{left:`${i}px`,top:`${r}px`}),this.arrow){let d=s.arrow.x,u=s.arrow.y,b="",f="",g="",v="";if(this.arrowPlacement==="start"){let m=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";b=typeof u=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"",f=c?m:"",v=c?"":m}else if(this.arrowPlacement==="end"){let m=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";f=c?"":m,v=c?m:"",g=typeof u=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:""}else this.arrowPlacement==="center"?(v=typeof d=="number"?"calc(50% - var(--arrow-size-diagonal))":"",b=typeof u=="number"?"calc(50% - var(--arrow-size-diagonal))":""):(v=typeof d=="number"?`${d}px`:"",b=typeof u=="number"?`${u}px`:"");Object.assign(this.arrowEl.style,{top:b,right:f,bottom:g,left:v,[h]:"calc(var(--arrow-base-offset) - var(--arrow-size-diagonal))"})}}),requestAnimationFrame(()=>this.updateHoverBridge()),this.dispatchEvent(new hr)}render(){return p`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${_({"popup-hover-bridge":!0,"popup-hover-bridge-visible":this.hoverBridge&&this.active})}
      ></span>

      <div
        popover="manual"
        part="popup"
        class=${_({popup:!0,"popup-active":this.active,"popup-fixed":!this.SUPPORTS_POPOVER,"popup-has-arrow":this.arrow})}
      >
        <slot></slot>
        ${this.arrow?p`<div part="arrow" class="arrow" role="presentation"></div>`:""}
      </div>
    `}};st.css=Nn;a([S(".popup")],st.prototype,"popup",2);a([S(".arrow")],st.prototype,"arrowEl",2);a([l({attribute:!1,type:Boolean})],st.prototype,"SUPPORTS_POPOVER",2);a([l()],st.prototype,"anchor",2);a([l({type:Boolean,reflect:!0})],st.prototype,"active",2);a([l({reflect:!0})],st.prototype,"placement",2);a([l()],st.prototype,"boundary",2);a([l({type:Number})],st.prototype,"distance",2);a([l({type:Number})],st.prototype,"skidding",2);a([l({type:Boolean})],st.prototype,"arrow",2);a([l({attribute:"arrow-placement"})],st.prototype,"arrowPlacement",2);a([l({attribute:"arrow-padding",type:Number})],st.prototype,"arrowPadding",2);a([l({type:Boolean})],st.prototype,"flip",2);a([l({attribute:"flip-fallback-placements",converter:{fromAttribute:t=>t.split(" ").map(e=>e.trim()).filter(e=>e!==""),toAttribute:t=>t.join(" ")}})],st.prototype,"flipFallbackPlacements",2);a([l({attribute:"flip-fallback-strategy"})],st.prototype,"flipFallbackStrategy",2);a([l({type:Object})],st.prototype,"flipBoundary",2);a([l({attribute:"flip-padding",type:Number})],st.prototype,"flipPadding",2);a([l({type:Boolean})],st.prototype,"shift",2);a([l({type:Object})],st.prototype,"shiftBoundary",2);a([l({attribute:"shift-padding",type:Number})],st.prototype,"shiftPadding",2);a([l({attribute:"auto-size"})],st.prototype,"autoSize",2);a([l()],st.prototype,"sync",2);a([l({type:Object})],st.prototype,"autoSizeBoundary",2);a([l({attribute:"auto-size-padding",type:Number})],st.prototype,"autoSizePadding",2);a([l({attribute:"hover-bridge",type:Boolean})],st.prototype,"hoverBridge",2);st=a([k("wa-popup")],st);var vl=C`
  :host {
    --divider-width: 0.125rem;
    --handle-size: 2.5rem;

    display: block;
    position: relative;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .before,
  .after {
    display: block;

    &::slotted(img),
    &::slotted(svg) {
      display: block;
      max-width: 100% !important;
      height: auto;
    }

    &::slotted(:not(img, svg)) {
      isolation: isolate;
    }
  }

  .after {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
  }

  /* Disable pointer-events while dragging. This is especially important for iframes. */
  :host(:state(dragging)) {
    .before,
    .after {
      pointer-events: none;
    }
  }

  .divider {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    width: var(--divider-width);
    height: 100%;
    background-color: var(--wa-color-surface-default);
    translate: calc(var(--divider-width) / -2);
    cursor: ew-resize;
  }

  .handle {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: calc(50% - (var(--handle-size) / 2));
    width: var(--handle-size);
    height: var(--handle-size);
    background-color: var(--wa-color-surface-default);
    border-radius: var(--wa-border-radius-circle);
    font-size: calc(var(--handle-size) * 0.4);
    color: var(--wa-color-neutral-on-quiet);
    cursor: inherit;
    z-index: 10;
  }

  .handle:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }
`;var Bo=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.position=50}handleDrag(t){let{width:e}=this.getBoundingClientRect(),o=this.localize.dir()==="rtl";t.preventDefault(),so(this,{onMove:i=>{this.customStates.set("dragging",!0),this.position=parseFloat(W(i/e*100,0,100).toFixed(2)),o&&(this.position=100-this.position)},onStop:()=>{this.customStates.set("dragging",!1)},initialEvent:t})}handleKeyDown(t){let e=this.matches(":dir(ltr)"),o=this.localize.dir()==="rtl";if(["ArrowLeft","ArrowRight","Home","End"].includes(t.key)){let i=t.shiftKey?10:1,r=this.position;t.preventDefault(),(e&&t.key==="ArrowLeft"||o&&t.key==="ArrowRight")&&(r-=i),(e&&t.key==="ArrowRight"||o&&t.key==="ArrowLeft")&&(r+=i),t.key==="Home"&&(r=0),t.key==="End"&&(r=100),r=W(r,0,100),this.position=r}}handlePositionChange(){this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}render(){let t=this.hasUpdated?this.localize.dir()==="rtl":this.dir==="rtl";return p`
      <div id="comparison" class="image" part="base comparison">
        <div part="before" class="before">
          <slot name="before"></slot>
        </div>

        <div
          part="after"
          class="after"
          style=${ct({clipPath:t?`inset(0 0 0 ${100-this.position}%)`:`inset(0 ${100-this.position}% 0 0)`})}
        >
          <slot name="after"></slot>
        </div>
      </div>

      <div
        part="divider"
        class="divider"
        style=${ct({left:t?`${100-this.position}%`:`${this.position}%`})}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleDrag}
        @touchstart=${this.handleDrag}
      >
        <div
          part="handle"
          class="handle"
          role="scrollbar"
          aria-valuenow=${this.position}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-controls="comparison"
          tabindex="0"
        >
          <slot name="handle">
            <wa-icon library="system" name="grip-vertical" variant="solid"></wa-icon>
          </slot>
        </div>
      </div>
    `}};Bo.css=vl;a([S(".handle")],Bo.prototype,"handle",2);a([l({type:Number,reflect:!0})],Bo.prototype,"position",2);a([y("position",{waitUntilFirstUpdate:!0})],Bo.prototype,"handlePositionChange",1);Bo=a([k("wa-comparison")],Bo);var wl=class extends Event{constructor(t){super("wa-copy",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var _a=null,Ta=null,uu=7e3;function yl(t){let e=document.createElement("div");return e.setAttribute("role","log"),e.setAttribute("aria-live",t),e.setAttribute("aria-relevant","additions"),Object.assign(e.style,{position:"absolute",width:"1px",height:"1px",margin:"-1px",padding:"0",border:"0",overflow:"hidden",clip:"rect(0 0 0 0)",clipPath:"inset(50%)",whiteSpace:"nowrap"}),e}function mu(t){return t==="assertive"?(Ta??(Ta=document.body.appendChild(yl("assertive"))),Ta):(_a??(_a=document.body.appendChild(yl("polite"))),_a)}function kr(t,e="polite"){if(!t)return;let o=mu(e),i=document.createElement("div");i.textContent=t,o.appendChild(i),setTimeout(()=>i.remove(),uu)}var xl=C`
  :host {
    display: inline-block;
    color: var(--wa-color-neutral-on-quiet);
  }

  .copy-button__trigger {
    position: relative;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: none;
    border-radius: var(--wa-form-control-border-radius);
    color: inherit;
    font-size: inherit;
    height: calc(var(--wa-form-control-height) * 0.8);
    aspect-ratio: 1;
    cursor: pointer;
    transition-property: background-color, color;
    transition-duration: var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
  }

  @media (hover: hover) {
    .button:hover:not([disabled]) {
      background-color: var(--wa-color-neutral-fill-quiet);
      color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
    }
  }

  .button:focus-visible:not([disabled]) {
    background-color: var(--wa-color-neutral-fill-quiet);
    color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
  }

  .button:active:not([disabled]) {
    color: color-mix(in oklab, currentColor, var(--wa-color-mix-active));
  }

  .button:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  .button[disabled] {
    opacity: 0.5;
    cursor: not-allowed !important;
  }

  slot {
    display: inline-flex;
  }

  /* Icon swap animation */
  .show {
    animation: copy-button-icon-show var(--wa-transition-fast) var(--wa-transition-easing);
  }

  .hide {
    animation: copy-button-icon-show var(--wa-transition-fast) var(--wa-transition-easing) reverse;
  }

  @keyframes copy-button-icon-show {
    from {
      scale: 0.25;
      opacity: 0.25;
    }
    to {
      scale: 1;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .show,
    .hide {
      animation-duration: 1ms;
    }
  }
`;var Cl="wa-internal-tooltip",Ma="__waCopyButtonAssignedId",bt=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.isCopying=!1,this.status="rest",this.hasCustomTrigger=!1,this.customTriggerEl=null,this.lightTooltip=null,this.feedbackTimeout=null,this.value="",this.from="",this.disabled=!1,this.copyLabel="",this.successLabel="",this.errorLabel="",this.feedbackDuration=1e3,this.tooltipPlacement="top",this.tooltip="full",this.handleDefaultSlotChange=()=>{let e=(this.defaultSlot?.assignedElements({flatten:!0})??[]).find(o=>o instanceof HTMLElement)??null;e!==this.customTriggerEl&&(this.releaseAssignedId(this.customTriggerEl),this.customTriggerEl=e),this.hasCustomTrigger=e!==null,e&&this.tooltip!=="none"?(e.id||(e.id=ee("wa-copy-button-trigger-"),e[Ma]=!0),this.ensureLightTooltip()):this.removeLightTooltip()}}get activeTooltip(){return this.lightTooltip??this.shadowTooltip??null}get currentLabel(){return this.status==="success"?this.successLabel||this.localize.term("copied"):this.status==="error"?this.errorLabel||this.localize.term("error"):this.copyLabel||this.localize.term("copy")}firstUpdated(){this.didSSR?this.updateComplete.then(()=>{this.handleDefaultSlotChange()}):this.handleDefaultSlotChange()}disconnectedCallback(){super.disconnectedCallback(),this.removeLightTooltip()}handleStatusChange(){this.customStates.set("success",this.status==="success"),this.customStates.set("error",this.status==="error"),this.syncTooltipText(),(this.status==="success"||this.status==="error")&&kr(this.currentLabel,"polite")}handleLabelChange(){this.syncTooltipText()}handleTooltipOptionsChange(){this.lightTooltip&&(this.lightTooltip.placement=this.tooltipPlacement,this.lightTooltip.disabled=this.disabled)}handleTooltipModeChange(t){this.tooltip==="none"?this.removeLightTooltip():t==="none"?this.handleDefaultSlotChange():this.lightTooltip&&this.lightTooltip.setAttribute("trigger",this.tooltip==="copy"?"manual":"hover focus")}releaseAssignedId(t){t&&t[Ma]&&(t.removeAttribute("id"),delete t[Ma])}ensureLightTooltip(){if(!this.customTriggerEl)return;let t=this.tooltip==="copy"?"manual":"hover focus";if(this.lightTooltip)this.lightTooltip.setAttribute("for",this.customTriggerEl.id),this.lightTooltip.setAttribute("trigger",t),this.lightTooltip.placement=this.tooltipPlacement,this.lightTooltip.disabled=this.disabled,this.lightTooltip.textContent=this.currentLabel;else{let e=document.createElement("wa-tooltip");e.setAttribute("slot",Cl),e.setAttribute("part","feedback"),e.setAttribute("trigger",t),e.dataset.copyButtonTooltip="",e.setAttribute("for",this.customTriggerEl.id),e.placement=this.tooltipPlacement,e.disabled=this.disabled,e.textContent=this.currentLabel,this.appendChild(e),this.lightTooltip=e}}removeLightTooltip(){this.lightTooltip&&(this.releaseAssignedId(this.customTriggerEl),this.lightTooltip.remove(),this.lightTooltip=null)}syncTooltipText(){this.lightTooltip&&(this.lightTooltip.textContent=this.currentLabel)}async handleCopy(){if(this.disabled||this.isCopying)return;this.isCopying=!0;let t=this.value;if(this.from){let e=this.getRootNode(),o=this.from.includes("."),i=this.from.includes("[")&&this.from.includes("]"),r=this.from,s="";o?[r,s]=this.from.trim().split("."):i&&([r,s]=this.from.trim().replace(/\]$/,"").split("["));let n="getElementById"in e?e.getElementById(r):null;n?i?t=n.getAttribute(s)||"":o?t=n[s]||"":t=n.textContent||"":(this.showStatus("error"),this.dispatchEvent(new Ie))}if(!t)this.showStatus("error"),this.dispatchEvent(new Ie);else try{await navigator.clipboard.writeText(t),this.showStatus("success"),this.dispatchEvent(new wl({value:t}))}catch{this.showStatus("error"),this.dispatchEvent(new Ie)}}async showStatus(t){if(this.status=t,this.copyIcon){let i=t==="success"?this.successIcon:this.errorIcon;await G(this.copyIcon,"hide"),this.copyIcon.hidden=!0,i.hidden=!1,await G(i,"show")}await this.updateComplete;let e=this.tooltip==="none"?null:this.activeTooltip,o=null;e&&(e.show(),o=new Promise(i=>{e.addEventListener("wa-after-hide",()=>{this.feedbackTimeout!==null&&(clearTimeout(this.feedbackTimeout),this.feedbackTimeout=null),i()},{once:!0})}),this.feedbackTimeout=window.setTimeout(async()=>{this.feedbackTimeout=null,await e.hide()},this.feedbackDuration)),setTimeout(async()=>{if(o&&await o,this.copyIcon){let i=t==="success"?this.successIcon:this.errorIcon;await G(i,"hide"),i.hidden=!0,this.copyIcon.hidden=!1,await G(this.copyIcon,"show")}this.status="rest",this.isCopying=!1},this.feedbackDuration)}render(){let e=!this.hasCustomTrigger&&this.tooltip!=="none",o=this.tooltip==="copy"?"manual":"hover focus";return this.didSSR&&!this.hasUpdated&&(e=!1),p`
      <div class="copy-button__trigger" @click=${this.handleCopy}>
        <slot @slotchange=${this.handleDefaultSlotChange}></slot>
        <button
          class="button"
          part="button"
          type="button"
          id="copy-button"
          aria-label=${this.currentLabel}
          ?disabled=${this.disabled}
          ?hidden=${this.hasCustomTrigger}
        >
          <slot part="copy-icon" name="copy-icon">
            <wa-icon library="system" name="copy" variant="regular"></wa-icon>
          </slot>
          <slot part="success-icon" name="success-icon" variant="solid" hidden>
            <wa-icon library="system" name="check"></wa-icon>
          </slot>
          <slot part="error-icon" name="error-icon" variant="solid" hidden>
            <wa-icon library="system" name="xmark"></wa-icon>
          </slot>
        </button>

        ${e?p`
              <wa-tooltip
                part="feedback"
                for="copy-button"
                placement=${this.tooltipPlacement}
                trigger=${o}
                class=${_({"copy-button-tooltip":!0,"copy-button-tooltip-success":this.status==="success","copy-button-tooltip-error":this.status==="error"})}
                ?disabled=${this.disabled}
                >${this.currentLabel}</wa-tooltip
              >
            `:""}
        <slot name="${Cl}"></slot>
      </div>
    `}};bt.css=[Yr,Pe,xl];a([S('slot[name="copy-icon"]')],bt.prototype,"copyIcon",2);a([S('slot[name="success-icon"]')],bt.prototype,"successIcon",2);a([S('slot[name="error-icon"]')],bt.prototype,"errorIcon",2);a([S("slot:not([name])")],bt.prototype,"defaultSlot",2);a([S('wa-tooltip[part="feedback"]')],bt.prototype,"shadowTooltip",2);a([A()],bt.prototype,"isCopying",2);a([A()],bt.prototype,"status",2);a([A()],bt.prototype,"hasCustomTrigger",2);a([l()],bt.prototype,"value",2);a([l()],bt.prototype,"from",2);a([l({type:Boolean,reflect:!0})],bt.prototype,"disabled",2);a([l({attribute:"copy-label"})],bt.prototype,"copyLabel",2);a([l({attribute:"success-label"})],bt.prototype,"successLabel",2);a([l({attribute:"error-label"})],bt.prototype,"errorLabel",2);a([l({attribute:"feedback-duration",type:Number})],bt.prototype,"feedbackDuration",2);a([l({attribute:"tooltip-placement",reflect:!0})],bt.prototype,"tooltipPlacement",2);a([l({reflect:!0})],bt.prototype,"tooltip",2);a([y("status")],bt.prototype,"handleStatusChange",1);a([y(["copyLabel","successLabel","errorLabel"])],bt.prototype,"handleLabelChange",1);a([y(["tooltipPlacement","disabled"],{waitUntilFirstUpdate:!0})],bt.prototype,"handleTooltipOptionsChange",1);a([y("tooltip",{waitUntilFirstUpdate:!0})],bt.prototype,"handleTooltipModeChange",1);bt=a([k("wa-copy-button")],bt);var kl=C`
  :host {
    --max-width: 30ch;

    /** These styles are added so we don't interfere in the DOM. */
    display: inline-block;
    position: absolute;

    /** Defaults for inherited CSS properties */
    color: var(--wa-tooltip-content-color);
    font-size: var(--wa-tooltip-font-size);
    line-height: var(--wa-tooltip-line-height);
    text-align: start;
    white-space: normal;
  }

  .tooltip {
    --arrow-size: var(--wa-tooltip-arrow-size);
    --arrow-color: var(--wa-tooltip-background-color);
  }

  .tooltip::part(popup) {
    z-index: 1000;
  }

  .tooltip[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .tooltip[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .tooltip[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .tooltip[placement^='right']::part(popup) {
    transform-origin: left;
  }

  .body {
    display: block;
    width: max-content;
    max-width: var(--max-width);
    border-radius: var(--wa-tooltip-border-radius);
    background-color: var(--wa-tooltip-background-color);
    border: var(--wa-tooltip-border-width) var(--wa-tooltip-border-style) var(--wa-tooltip-border-color);
    padding: 0.25em 0.5em;
    user-select: none;
    -webkit-user-select: none;
  }

  .tooltip {
    --popup-border-width: var(--wa-tooltip-border-width);

    /* Inset box-shadow, not a border: Safari seams a clip-path edge that runs along a border. */
    &::part(arrow) {
      box-shadow: inset calc(-1 * var(--wa-tooltip-border-width)) calc(-1 * var(--wa-tooltip-border-width)) 0 0
        var(--wa-tooltip-border-color);
    }
  }
`;var Bt=class extends Event{constructor(){super("wa-show",{bubbles:!0,cancelable:!0,composed:!0})}};var Ft=class extends Event{constructor(t){super("wa-hide",{bubbles:!0,cancelable:!0,composed:!0}),this.detail=t}};var Vt=class extends Event{constructor(){super("wa-after-show",{bubbles:!0,cancelable:!1,composed:!0})}};var qt=class extends Event{constructor(){super("wa-after-hide",{bubbles:!0,cancelable:!1,composed:!0})}};var kt=class extends E{constructor(){super(...arguments),this.placement="top",this.disabled=!1,this.distance=8,this.open=!1,this.skidding=0,this.showDelay=150,this.hideDelay=0,this.trigger="hover focus",this.withoutArrow=!1,this.for=null,this.anchor=null,this.eventController=new AbortController,this.handleBlur=()=>{this.hasTrigger("focus")&&this.hide()},this.handleClick=()=>{this.hasTrigger("click")&&(this.open?this.hide():this.show())},this.handleFocus=()=>{this.hasTrigger("focus")&&this.show()},this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.open&&Dt(this)&&(t.preventDefault(),t.stopPropagation(),this.hide())},this.handleMouseOver=()=>{this.hasTrigger("hover")&&(clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.show(),this.showDelay))},this.handleMouseOut=t=>{if(this.hasTrigger("hover")){let e=t.relatedTarget,o=!!(e&&this.anchor?.contains(e)),i=!!(e&&this.contains(e));if(o||i)return;clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>{this.hide()},this.hideDelay)}}}connectedCallback(){super.connectedCallback(),typeof document<"u"&&(this.eventController.signal.aborted&&(this.eventController=new AbortController),this.addEventListener("mouseout",this.handleMouseOut),this.open&&(this.open=!1,this.updateComplete.then(()=>{this.open=!0})),this.id||(this.id=ee("wa-tooltip-")),this.for&&this.anchor?(this.anchor=null,this.handleForChange()):this.for&&this.handleForChange())}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleDocumentKeyDown),It(this),this.eventController.abort(),this.anchor&&this.removeFromAriaLabelledBy(this.anchor,this.id)}firstUpdated(){this.body.hidden=!this.open,this.open&&(this.popup.active=!0,this.popup.reposition())}hasTrigger(t){return this.trigger.split(" ").includes(t)}addToAriaLabelledBy(t,e){let i=(t.getAttribute("aria-labelledby")||"").split(/\s+/).filter(Boolean);i.includes(e)||(i.push(e),t.setAttribute("aria-labelledby",i.join(" ")))}removeFromAriaLabelledBy(t,e){let r=(t.getAttribute("aria-labelledby")||"").split(/\s+/).filter(Boolean).filter(s=>s!==e);r.length>0?t.setAttribute("aria-labelledby",r.join(" ")):t.removeAttribute("aria-labelledby")}async handleOpenChange(){if(this.open){if(this.disabled)return;let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}document.addEventListener("keydown",this.handleDocumentKeyDown,{signal:this.eventController.signal}),Kt(this),this.body.hidden=!1,this.popup.active=!0,await G(this.popup.popup,"show-with-scale"),this.popup.reposition(),this.dispatchEvent(new Vt)}else{let t=new Ft;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}document.removeEventListener("keydown",this.handleDocumentKeyDown),It(this),await G(this.popup.popup,"hide-with-scale"),this.popup.active=!1,this.body.hidden=!0,this.dispatchEvent(new qt)}}handleForChange(){let t=this.getRootNode?.();if(!t)return;let e=this.for?t.getElementById?.(this.for):null,o=this.anchor;if(e===o)return;let{signal:i}=this.eventController;e&&(this.addToAriaLabelledBy(e,this.id),e.addEventListener("blur",this.handleBlur,{capture:!0,signal:i}),e.addEventListener("focus",this.handleFocus,{capture:!0,signal:i}),e.addEventListener("click",this.handleClick,{signal:i}),e.addEventListener("mouseover",this.handleMouseOver,{signal:i}),e.addEventListener("mouseout",this.handleMouseOut,{signal:i})),o&&(this.removeFromAriaLabelledBy(o,this.id),o.removeEventListener("blur",this.handleBlur,{capture:!0}),o.removeEventListener("focus",this.handleFocus,{capture:!0}),o.removeEventListener("click",this.handleClick),o.removeEventListener("mouseover",this.handleMouseOver),o.removeEventListener("mouseout",this.handleMouseOut)),this.anchor=e}async handleOptionsChange(){this.hasUpdated&&(await this.updateComplete,this.popup.reposition())}handleDisabledChange(){this.disabled&&this.open&&this.hide()}async show(){if(!this.open)return this.open=!0,Ct(this,"wa-after-show")}async hide(){if(this.open)return this.open=!1,Ct(this,"wa-after-hide")}render(){return p`
      <wa-popup
        part="base tooltip"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${_({tooltip:!0,"tooltip-open":this.open})}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        flip
        shift
        ?arrow=${!this.withoutArrow}
        hover-bridge
        .anchor=${this.anchor}
      >
        <div part="body" class="body">
          <slot></slot>
        </div>
      </wa-popup>
    `}};kt.css=kl;kt.dependencies={"wa-popup":st};a([S("slot:not([name])")],kt.prototype,"defaultSlot",2);a([S(".body")],kt.prototype,"body",2);a([S("wa-popup")],kt.prototype,"popup",2);a([l()],kt.prototype,"placement",2);a([l({type:Boolean,reflect:!0})],kt.prototype,"disabled",2);a([l({type:Number})],kt.prototype,"distance",2);a([l({type:Boolean,reflect:!0})],kt.prototype,"open",2);a([l({type:Number})],kt.prototype,"skidding",2);a([l({attribute:"show-delay",type:Number})],kt.prototype,"showDelay",2);a([l({attribute:"hide-delay",type:Number})],kt.prototype,"hideDelay",2);a([l()],kt.prototype,"trigger",2);a([l({attribute:"without-arrow",type:Boolean,reflect:!0})],kt.prototype,"withoutArrow",2);a([l()],kt.prototype,"for",2);a([A()],kt.prototype,"anchor",2);a([y("open",{waitUntilFirstUpdate:!0})],kt.prototype,"handleOpenChange",1);a([y("for")],kt.prototype,"handleForChange",1);a([y(["distance","placement","skidding"])],kt.prototype,"handleOptionsChange",1);a([y("disabled")],kt.prototype,"handleDisabledChange",1);kt=a([k("wa-tooltip")],kt);var Sl=C`
  :host {
    --spacing: var(--wa-space-m);
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: block;
  }

  details {
    display: block;
    overflow-anchor: none;
    border: var(--wa-panel-border-width) var(--wa-color-surface-border) var(--wa-panel-border-style);
    background-color: var(--wa-color-surface-default);
    border-radius: var(--wa-panel-border-radius);
    color: var(--wa-color-text-normal);

    /* Print styles */
    @media print {
      background: none;
      border: solid var(--wa-border-width-s) var(--wa-color-surface-border);

      summary {
        list-style: none;
      }
    }
  }

  /* Appearance modifiers */
  :host([appearance='plain']) details {
    background-color: transparent;
    border-color: transparent;
    border-radius: 0;
  }

  :host([appearance='outlined']) details {
    background-color: var(--wa-color-surface-default);
    border-color: var(--wa-color-surface-border);
  }

  :host([appearance='filled']) details {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: transparent;
  }

  :host([appearance='filled-outlined']) details {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-neutral-border-quiet);
  }

  :host([disabled]) details {
    opacity: 0.5;
    cursor: not-allowed;
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing);
    padding: var(--spacing); /* Add padding here */
    border-radius: calc(var(--wa-panel-border-radius) - var(--wa-panel-border-width));
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

    &::marker,
    &::-webkit-details-marker {
      display: none;
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: calc(var(--wa-panel-border-width) + var(--wa-focus-ring-offset));
    }
  }

  :host([open]) summary {
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }

  /* 'Start' icon placement */
  :host([icon-placement='start']) summary {
    flex-direction: row-reverse;
    justify-content: start;
  }

  [part~='icon'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    color: var(--wa-color-text-quiet);
    transition: rotate var(--wa-transition-normal) var(--wa-transition-easing);
  }

  :host([open]) [part~='icon'] {
    rotate: 90deg;
  }

  :host([open]:dir(rtl)) [part~='icon'] {
    rotate: -90deg;
  }

  :host([open]) slot[name='expand-icon'],
  :host(:not([open])) slot[name='collapse-icon'] {
    display: none;
  }

  .body.animating {
    overflow: hidden;
  }

  .content {
    display: block;
    box-sizing: border-box; /* Ensure contents don't overflow */
    padding-block-start: var(--spacing);
    padding-inline: var(--spacing); /* Add horizontal padding */
    padding-block-end: var(--spacing); /* Add bottom padding */
  }
`;var Xt=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.animationGeneration=0,this.isAnimating=!1,this.open=!1,this.disabled=!1,this.appearance="outlined",this.iconPlacement="end"}disconnectedCallback(){super.disconnectedCallback(),this.detailsObserver?.disconnect()}firstUpdated(){this.body.style.height=this.open?"auto":"0",this.open&&(this.details.open=!0),this.detailsObserver=new MutationObserver(t=>{for(let e of t)e.type==="attributes"&&e.attributeName==="open"&&(this.details.open?this.show():this.hide())}),this.detailsObserver.observe(this.details,{attributes:!0})}updated(t){t.has("isAnimating")&&this.customStates.set("animating",this.isAnimating)}handleSummaryClick(t){t.composedPath().some(i=>{if(!(i instanceof HTMLElement))return!1;let r=i.tagName?.toLowerCase();return["a","button","input","textarea","select"].includes(r)?!0:i instanceof q?!("disabled"in i)||!i.disabled:!1})||(t.preventDefault(),this.disabled||(this.open?this.hide():this.show(),this.header.focus()))}handleSummaryKeyDown(t){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.open?this.hide():this.show()),(t.key==="ArrowUp"||t.key==="ArrowLeft")&&(t.preventDefault(),this.hide()),(t.key==="ArrowDown"||t.key==="ArrowRight")&&(t.preventDefault(),this.show())}closeOthersWithSameName(){if(!this.name)return;this.getRootNode().querySelectorAll(`wa-details[name="${this.name}"]`).forEach(o=>{o!==this&&o.open&&(o.open=!1)})}async handleOpenChange(){this.animationGeneration++;let t=this.animationGeneration;if(this.open){this.details.open=!0;let e=new Bt;if(this.dispatchEvent(e),e.defaultPrevented){this.open=!1,this.details.open=!1;return}this.closeOthersWithSameName(),this.isAnimating=!0;let o=Ke(getComputedStyle(this.body).getPropertyValue("--show-duration"));if(await ke(this.body,[{height:"0",opacity:"0"},{height:`${this.body.scrollHeight}px`,opacity:"1"}],{duration:o,easing:"linear"}),this.animationGeneration!==t)return;this.body.style.height="auto",this.isAnimating=!1,this.dispatchEvent(new Vt)}else{let e=new Ft;if(this.dispatchEvent(e),e.defaultPrevented){this.details.open=!0,this.open=!0;return}this.isAnimating=!0;let o=Ke(getComputedStyle(this.body).getPropertyValue("--hide-duration"));if(await ke(this.body,[{height:`${this.body.scrollHeight}px`,opacity:"1"},{height:"0",opacity:"0"}],{duration:o,easing:"linear"}),this.animationGeneration!==t)return;this.body.style.height="0",this.isAnimating=!1,this.details.open=!1,this.dispatchEvent(new qt)}}async show(){if(!(this.open||this.disabled))return this.open=!0,Ct(this,"wa-after-show")}async hide(){if(!(!this.open||this.disabled))return this.open=!1,Ct(this,"wa-after-hide")}render(){let t=this.hasUpdated?this.localize.dir()==="rtl":this.dir==="rtl";return p`
      <details part="base details">
        <summary
          part="header"
          role="button"
          aria-expanded=${this.open?"true":"false"}
          aria-controls="content"
          aria-disabled=${this.disabled?"true":"false"}
          tabindex=${this.disabled?"-1":"0"}
          @click=${this.handleSummaryClick}
          @keydown=${this.handleSummaryKeyDown}
        >
          <slot name="summary" part="summary">${this.summary}</slot>

          <span part="icon">
            <slot name="expand-icon">
              <wa-icon library="system" variant="solid" name=${t?"chevron-left":"chevron-right"}></wa-icon>
            </slot>
            <slot name="collapse-icon">
              <wa-icon library="system" variant="solid" name=${t?"chevron-left":"chevron-right"}></wa-icon>
            </slot>
          </span>
        </summary>

        <div
          class=${_({body:!0,animating:this.isAnimating})}
          role="region"
          aria-labelledby="header"
        >
          <slot part="content" id="content" class="content"></slot>
        </div>
      </details>
    `}};Xt.css=Sl;a([S("details")],Xt.prototype,"details",2);a([S("summary")],Xt.prototype,"header",2);a([S(".body")],Xt.prototype,"body",2);a([S(".expand-icon-slot")],Xt.prototype,"expandIconSlot",2);a([A()],Xt.prototype,"isAnimating",2);a([l({type:Boolean,reflect:!0})],Xt.prototype,"open",2);a([l()],Xt.prototype,"summary",2);a([l({reflect:!0})],Xt.prototype,"name",2);a([l({type:Boolean,reflect:!0})],Xt.prototype,"disabled",2);a([l({reflect:!0})],Xt.prototype,"appearance",2);a([l({attribute:"icon-placement",reflect:!0})],Xt.prototype,"iconPlacement",2);a([y("open",{waitUntilFirstUpdate:!0})],Xt.prototype,"handleOpenChange",1);Xt=a([k("wa-details")],Xt);var Sr=class{constructor(t,e){this.element=t,this.callback=e}start(...t){if(!!1){this.observer??(this.observer=new ResizeObserver(()=>this.check())),this.observer.observe(this.element);for(let e of t)this.observer.observe(e);this.initialCheckHandle??(this.initialCheckHandle=requestAnimationFrame(()=>{this.initialCheckHandle=void 0,this.check()}))}}stop(){this.initialCheckHandle!==void 0&&(cancelAnimationFrame(this.initialCheckHandle),this.initialCheckHandle=void 0),this.observer?.disconnect()}check(){this.callback(this.element.getClientRects().length>0)}};function fu(t,e){return{top:Math.round(t.getBoundingClientRect().top-e.getBoundingClientRect().top),left:Math.round(t.getBoundingClientRect().left-e.getBoundingClientRect().left)}}var Ia=new Set;function gu(){let t=document.documentElement.clientWidth;return Math.abs(window.innerWidth-t)}function bu(){let t=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(t)||!t?0:t}function mo(t){if(Ia.add(t),!document.documentElement.classList.contains("wa-scroll-lock")){let e=gu()+bu(),o=getComputedStyle(document.documentElement).scrollbarGutter;(!o||o==="auto")&&(o="stable"),e<2&&(o=""),document.documentElement.style.setProperty("--wa-scroll-lock-gutter",o),document.documentElement.classList.add("wa-scroll-lock"),document.documentElement.style.setProperty("--wa-scroll-lock-size",`${e}px`)}}function fo(t){Ia.delete(t),Ia.size===0&&(document.documentElement.classList.remove("wa-scroll-lock"),document.documentElement.style.removeProperty("--wa-scroll-lock-size"))}function go(t,e,o="vertical",i="smooth"){let r=fu(t,e),s=r.top+e.scrollTop,n=r.left+e.scrollLeft,c=e.scrollLeft,h=e.scrollLeft+e.offsetWidth,d=e.scrollTop,u=e.scrollTop+e.offsetHeight;(o==="horizontal"||o==="both")&&(n<c?e.scrollTo({left:n,behavior:i}):n+t.clientWidth>h&&e.scrollTo({left:n-e.offsetWidth+t.clientWidth,behavior:i})),(o==="vertical"||o==="both")&&(s<d?e.scrollTo({top:s,behavior:i}):s+t.clientHeight>u&&e.scrollTo({top:s-e.offsetHeight+t.clientHeight,behavior:i}))}function bo(t){return t.split(" ").map(e=>e.trim()).filter(e=>e!=="")}var zl=C`
  :host {
    --width: 31rem;
    --spacing: var(--wa-space-l);
    --backdrop-filter: none;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: none;
  }

  :host([open]) {
    display: block;
  }

  .dialog {
    display: flex;
    flex-direction: column;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: var(--width);
    max-width: calc(100% - var(--wa-space-2xl));
    max-height: calc(100% - var(--wa-space-2xl));
    color: inherit;
    background-color: var(--wa-color-surface-raised);
    border-radius: var(--wa-panel-border-radius);
    border: none;
    box-shadow: var(--wa-shadow-l);
    padding: 0;
    margin: auto;

    &.show {
      animation: show-dialog var(--show-duration) ease;

      &::backdrop {
        animation: show-backdrop var(--show-duration, 200ms) ease;
      }
    }

    &.hide {
      animation: show-dialog var(--hide-duration) ease reverse;

      &::backdrop {
        animation: show-backdrop var(--hide-duration, 200ms) ease reverse;
      }
    }

    &.pulse {
      animation: pulse 250ms ease;
    }
  }

  .dialog:focus {
    outline: none;
  }

  /* Ensure there's enough vertical padding for phones that don't update vh when chrome appears (e.g. iPhone) */
  @media screen and (max-width: 420px) {
    .dialog {
      max-height: 80vh;
    }
  }

  .open {
    display: flex;
    opacity: 1;
  }

  .header {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: nowrap;

    padding-inline-start: var(--spacing);
    padding-block-end: 0;

    /* Subtract the close button's padding so that the X is visually aligned with the edges of the dialog content */
    padding-inline-end: calc(var(--spacing) - var(--wa-form-control-padding-block));
    padding-block-start: calc(var(--spacing) - var(--wa-form-control-padding-block));
  }

  .title {
    align-self: center;
    flex: 1 1 auto;
    font-family: inherit;
    font-size: var(--wa-font-size-l);
    font-weight: var(--wa-font-weight-heading);
    line-height: var(--wa-line-height-condensed);
    margin: 0;
  }

  .header-actions {
    align-self: start;
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--wa-space-2xs);
    padding-inline-start: var(--spacing);
  }

  .header-actions wa-button,
  .header-actions ::slotted(wa-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .body {
    flex: 1 1 auto;
    display: block;
    padding: var(--spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }

  .footer {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: var(--wa-space-xs);
    justify-content: end;
    padding: var(--spacing);
    padding-block-start: 0;
  }

  .footer ::slotted(wa-button:not(:first-of-type)) {
    margin-inline-start: var(--wa-spacing-xs);
  }

  .dialog::backdrop {
    /*
      NOTE: the ::backdrop element doesn't inherit properly in Safari yet, but it will in 17.4! At that time, we can
      remove the fallback values here.
    */
    background-color: var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25));
    backdrop-filter: var(--backdrop-filter);
  }

  @keyframes pulse {
    0% {
      scale: 1;
    }
    50% {
      scale: 1.02;
    }
    100% {
      scale: 1;
    }
  }

  @keyframes show-dialog {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  @keyframes show-backdrop {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (forced-colors: active) {
    .dialog {
      border: solid 1px white;
    }
  }
`;var $e=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.hasSlotController=new Z(this,"footer","header-actions","label"),this.renderedWatcher=new Sr(this,t=>this.handleRenderedChange(t)),this.open=!1,this.label="",this.withoutHeader=!1,this.lightDismiss=!1,this.withFooter=!1,this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.open&&Dt(this)&&(t.preventDefault(),t.stopPropagation(),this.requestClose(this.dialog))}}firstUpdated(){this.open&&(this.addOpenListeners(),this.dialog.showModal(),mo(this),this.renderedWatcher.start(this.dialog))}disconnectedCallback(){super.disconnectedCallback(),this.renderedWatcher.stop(),fo(this),this.removeOpenListeners()}async requestClose(t){let e=new Ft({source:t});if(this.dispatchEvent(e),e.defaultPrevented){this.open=!0,G(this.dialog,"pulse");return}this.removeOpenListeners(),await G(this.dialog,"hide"),this.open=!1,this.dialog.close(),fo(this),this.renderedWatcher.stop();let o=this.originalTrigger;typeof o?.focus=="function"&&setTimeout(()=>o.focus()),this.dispatchEvent(new qt)}addOpenListeners(){document.addEventListener("keydown",this.handleDocumentKeyDown),Kt(this)}removeOpenListeners(){document.removeEventListener("keydown",this.handleDocumentKeyDown),It(this)}handleDialogCancel(t){t.preventDefault(),!this.dialog.classList.contains("hide")&&t.target===this.dialog&&Dt(this)&&this.requestClose(this.dialog)}handleDialogClick(t){let o=t.target.closest('[data-dialog="close"]');o&&(t.stopPropagation(),this.requestClose(o))}async handleDialogPointerDown(t){t.target===this.dialog&&(this.lightDismiss?this.requestClose(this.dialog):await G(this.dialog,"pulse"))}handleRenderedChange(t){if(!this.open){this.renderedWatcher.stop();return}!t&&this.dialog.open?(this.removeOpenListeners(),this.dialog.close(),fo(this)):t&&!this.dialog.open&&(this.addOpenListeners(),this.dialog.showModal(),mo(this))}handleOpenChange(){this.open&&!this.dialog.open?this.show():!this.open&&this.dialog.open?(this.open=!0,this.requestClose(this.dialog)):this.open||this.renderedWatcher.stop()}async show(){let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}this.addOpenListeners(),this.originalTrigger=document.activeElement,this.open=!0,this.dialog.showModal(),mo(this),this.renderedWatcher.start(this.dialog),requestAnimationFrame(()=>{let e=this.querySelector("[autofocus]");e&&typeof e.focus=="function"?e.focus():this.dialog.focus()}),await G(this.dialog,"show"),this.dispatchEvent(new Vt)}render(){let t=!this.withoutHeader,e=this.hasSlotController.test("footer","withFooter");return p`
      <dialog
        part="dialog"
        class=${_({dialog:!0,open:this.open})}
        @cancel=${this.handleDialogCancel}
        @click=${this.handleDialogClick}
        @pointerdown=${this.handleDialogPointerDown}
      >
        ${t?p`
              <header part="header" class="header">
                <h2 part="title" class="title" id="title">
                  <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                  <slot name="label"> ${this.label.length>0?this.label:"\u200B"} </slot>
                </h2>
                <div part="header-actions" class="header-actions">
                  <slot name="header-actions"></slot>
                  <wa-button
                    part="close-button"
                    exportparts="base:close-button__base"
                    class="close"
                    appearance="plain"
                    @click="${o=>this.requestClose(o.target)}"
                  >
                    <wa-icon
                      name="xmark"
                      label=${this.localize.term("close")}
                      library="system"
                      variant="solid"
                    ></wa-icon>
                  </wa-button>
                </div>
              </header>
            `:""}

        <div part="body" class="body"><slot></slot></div>

        <!-- Use a hidden element so we still get "slotchange" events. -->
        <footer part="footer" class="footer" ?hidden=${!e}>
          <slot name="footer"></slot>
        </footer>
      </dialog>
    `}};$e.css=zl;a([S(".dialog")],$e.prototype,"dialog",2);a([l({type:Boolean,reflect:!0})],$e.prototype,"open",2);a([l({reflect:!0})],$e.prototype,"label",2);a([l({attribute:"without-header",type:Boolean,reflect:!0})],$e.prototype,"withoutHeader",2);a([l({attribute:"light-dismiss",type:Boolean})],$e.prototype,"lightDismiss",2);a([l({attribute:"with-footer",type:Boolean})],$e.prototype,"withFooter",2);a([y("open",{waitUntilFirstUpdate:!0})],$e.prototype,"handleOpenChange",1);$e=a([k("wa-dialog")],$e);document.addEventListener("click",t=>{let e=t.target.closest("[data-dialog]");if(e instanceof Element){let[o,i]=bo(e.getAttribute("data-dialog")||"");if(o==="open"&&i?.length){let s=e.getRootNode().getElementById(i);s?.localName==="wa-dialog"?s.open=!0:console.warn(`A dialog with an ID of "${i}" could not be found in this document.`)}}}),document.addEventListener("pointerdown",()=>{});var El=C`
  :host {
    --color: var(--wa-color-surface-border);
    --width: var(--wa-border-width-s);
    --spacing: var(--wa-space-m);
  }

  :host(:not([orientation='vertical'])) {
    display: block;
    border-top: solid var(--width) var(--color);
    margin: var(--spacing) 0;
  }

  :host([orientation='vertical']) {
    display: inline-block;
    height: 100%;
    border-inline-start: solid var(--width) var(--color);
    margin: 0 var(--spacing);
    min-block-size: 1lh;
  }
`;var Zo=class extends E{constructor(){super(...arguments),this.orientation="horizontal"}connectedCallback(){super.connectedCallback(),this.setAttribute("role","separator")}handleVerticalChange(){this.setAttribute("aria-orientation",this.orientation)}};Zo.css=El;a([l({reflect:!0})],Zo.prototype,"orientation",2);a([y("orientation")],Zo.prototype,"handleVerticalChange",1);Zo=a([k("wa-divider")],Zo);var Ll=C`
  :host {
    --size: 25rem;
    --spacing: var(--wa-space-l);
    --backdrop-filter: none;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: none;
  }

  :host([open]) {
    display: block;
  }

  .drawer {
    display: flex;
    flex-direction: column;
    top: 0;
    inset-inline-start: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    color: inherit;
    background-color: var(--wa-color-surface-raised);
    border: none;
    box-shadow: var(--wa-shadow-l);
    overflow: auto;
    padding: 0;
    margin: 0;
    animation-duration: var(--show-duration);
    animation-timing-function: ease;

    &.show::backdrop {
      animation: show-backdrop var(--show-duration, 200ms) ease;
    }

    &.hide::backdrop {
      animation: show-backdrop var(--hide-duration, 200ms) ease reverse;
    }

    &.show.top {
      animation: show-drawer-from-top var(--show-duration) ease;
    }

    &.hide.top {
      animation: show-drawer-from-top var(--hide-duration) ease reverse;
    }

    &.show.end {
      animation: show-drawer-from-end var(--show-duration) ease;

      &:dir(rtl) {
        animation-name: show-drawer-from-start;
      }
    }

    &.hide.end {
      animation: show-drawer-from-end var(--hide-duration) ease reverse;

      &:dir(rtl) {
        animation-name: show-drawer-from-start;
      }
    }

    &.show.bottom {
      animation: show-drawer-from-bottom var(--show-duration) ease;
    }

    &.hide.bottom {
      animation: show-drawer-from-bottom var(--hide-duration) ease reverse;
    }

    &.show.start {
      animation: show-drawer-from-start var(--show-duration) ease;

      &:dir(rtl) {
        animation-name: show-drawer-from-end;
      }
    }

    &.hide.start {
      animation: show-drawer-from-start var(--hide-duration) ease reverse;

      &:dir(rtl) {
        animation-name: show-drawer-from-end;
      }
    }

    &.pulse {
      animation: pulse 250ms ease;
    }
  }

  .drawer:focus {
    outline: none;
  }

  .top {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .end {
    top: 0;
    inset-inline-end: 0;
    bottom: auto;
    inset-inline-start: auto;
    width: var(--size);
    height: 100%;
  }

  .bottom {
    top: auto;
    inset-inline-end: auto;
    bottom: 0;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .start {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: var(--size);
    height: 100%;
  }

  .header {
    display: flex;
    flex-wrap: nowrap;
    padding-inline-start: var(--spacing);
    padding-block-end: 0;

    /* Subtract the close button's padding so that the X is visually aligned with the edges of the dialog content */
    padding-inline-end: calc(var(--spacing) - var(--wa-form-control-padding-block));
    padding-block-start: calc(var(--spacing) - var(--wa-form-control-padding-block));
  }

  .title {
    align-self: center;
    flex: 1 1 auto;
    font: inherit;
    font-size: var(--wa-font-size-l);
    font-weight: var(--wa-font-weight-heading);
    line-height: var(--wa-line-height-condensed);
    margin: 0;
  }

  .header-actions {
    align-self: start;
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--wa-space-2xs);
    padding-inline-start: var(--spacing);
  }

  .header-actions wa-button,
  .header-actions ::slotted(wa-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .body {
    flex: 1 1 auto;
    display: block;
    padding: var(--spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--wa-space-xs);
    justify-content: end;
    padding: var(--spacing);
    padding-block-start: 0;
  }

  .footer ::slotted(wa-button:not(:last-of-type)) {
    margin-inline-end: var(--wa-spacing-xs);
  }

  .drawer::backdrop {
    /*
        NOTE: the ::backdrop element doesn't inherit properly in Safari yet, but it will in 17.4! At that time, we can
        remove the fallback values here.
      */
    background-color: var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25));
    backdrop-filter: var(--backdrop-filter);
  }

  @keyframes pulse {
    0% {
      scale: 1;
    }
    50% {
      scale: 1.01;
    }
    100% {
      scale: 1;
    }
  }

  @keyframes show-drawer {
    from {
      opacity: 0;
      scale: 0.8;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  @keyframes show-drawer-from-top {
    from {
      opacity: 0;
      translate: 0 -100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-end {
    from {
      opacity: 0;
      translate: 100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-bottom {
    from {
      opacity: 0;
      translate: 0 100%;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-drawer-from-start {
    from {
      opacity: 0;
      translate: -100% 0;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes show-backdrop {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (forced-colors: active) {
    .drawer {
      border: solid 1px white;
    }
  }
`;var we=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.hasSlotController=new Z(this,"footer","header-actions","label"),this.renderedWatcher=new Sr(this,t=>this.handleRenderedChange(t)),this.open=!1,this.label="",this.placement="end",this.withoutHeader=!1,this.lightDismiss=!1,this.withFooter=!1,this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.open&&Dt(this)&&(t.preventDefault(),t.stopPropagation(),this.requestClose(this.drawer))}}firstUpdated(){this.open&&(this.addOpenListeners(),this.drawer.showModal(),mo(this),this.renderedWatcher.start(this.drawer))}disconnectedCallback(){super.disconnectedCallback(),this.renderedWatcher.stop(),fo(this),this.removeOpenListeners()}async requestClose(t){let e=new Ft({source:t});if(this.dispatchEvent(e),e.defaultPrevented){this.open=!0,G(this.drawer,"pulse");return}this.removeOpenListeners(),await G(this.drawer,"hide"),this.open=!1,this.drawer.close(),fo(this),this.renderedWatcher.stop();let o=this.originalTrigger;typeof o?.focus=="function"&&setTimeout(()=>o.focus()),this.dispatchEvent(new qt)}addOpenListeners(){document.addEventListener("keydown",this.handleDocumentKeyDown),Kt(this)}removeOpenListeners(){document.removeEventListener("keydown",this.handleDocumentKeyDown),It(this)}handleDialogCancel(t){t.preventDefault(),!this.drawer.classList.contains("hide")&&t.target===this.drawer&&Dt(this)&&this.requestClose(this.drawer)}handleDialogClick(t){let o=t.target.closest('[data-drawer="close"]');o&&(t.stopPropagation(),this.requestClose(o))}async handleDialogPointerDown(t){t.target===this.drawer&&(this.lightDismiss?this.requestClose(this.drawer):await G(this.drawer,"pulse"))}handleRenderedChange(t){if(!this.open){this.renderedWatcher.stop();return}!t&&this.drawer.open?(this.removeOpenListeners(),this.drawer.close(),fo(this)):t&&!this.drawer.open&&(this.addOpenListeners(),this.drawer.showModal(),mo(this))}handleOpenChange(){this.open&&!this.drawer.open?this.show():this.drawer.open?(this.open=!0,this.requestClose(this.drawer)):this.open||this.renderedWatcher.stop()}async show(){let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}this.addOpenListeners(),this.originalTrigger=document.activeElement,this.open=!0,this.drawer.showModal(),mo(this),this.renderedWatcher.start(this.drawer),requestAnimationFrame(()=>{let e=this.querySelector("[autofocus]");e&&typeof e.focus=="function"?e.focus():this.drawer.focus()}),await G(this.drawer,"show"),this.dispatchEvent(new Vt)}render(){let t=!this.withoutHeader,e=this.hasSlotController.test("footer","withFooter");return p`
      <dialog
        part="dialog"
        class=${_({drawer:!0,open:this.open,top:this.placement==="top",end:this.placement==="end",bottom:this.placement==="bottom",start:this.placement==="start"})}
        @cancel=${this.handleDialogCancel}
        @click=${this.handleDialogClick}
        @pointerdown=${this.handleDialogPointerDown}
      >
        ${t?p`
              <header part="header" class="header">
                <h2 part="title" class="title" id="title">
                  <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                  <slot name="label"> ${this.label.length>0?this.label:"\u200B"} </slot>
                </h2>
                <div part="header-actions" class="header-actions">
                  <slot name="header-actions"></slot>
                  <wa-button
                    part="close-button"
                    exportparts="base:close-button__base"
                    class="close"
                    appearance="plain"
                    @click="${o=>this.requestClose(o.target)}"
                  >
                    <wa-icon
                      name="xmark"
                      label=${this.localize.term("close")}
                      library="system"
                      variant="solid"
                    ></wa-icon>
                  </wa-button>
                </div>
              </header>
            `:""}

        <div part="body" class="body"><slot></slot></div>

        <footer part="footer" class="footer" ?hidden=${!e}>
          <slot name="footer"></slot>
        </footer>
      </dialog>
    `}};we.css=Ll;a([S(".drawer")],we.prototype,"drawer",2);a([l({type:Boolean,reflect:!0})],we.prototype,"open",2);a([l({reflect:!0})],we.prototype,"label",2);a([l({reflect:!0})],we.prototype,"placement",2);a([l({attribute:"without-header",type:Boolean,reflect:!0})],we.prototype,"withoutHeader",2);a([l({attribute:"light-dismiss",type:Boolean})],we.prototype,"lightDismiss",2);a([l({attribute:"with-footer",type:Boolean})],we.prototype,"withFooter",2);a([y("open",{waitUntilFirstUpdate:!0})],we.prototype,"handleOpenChange",1);we=a([k("wa-drawer")],we);document.addEventListener("click",t=>{let e=t.target.closest("[data-drawer]");if(e instanceof Element){let[o,i]=bo(e.getAttribute("data-drawer")||"");if(o==="open"&&i?.length){let s=e.getRootNode().getElementById(i);s?.localName==="wa-drawer"?s.open=!0:console.warn(`A drawer with an ID of "${i}" could not be found in this document.`)}}}),document.addEventListener("pointerdown",()=>{});var $l=class extends Event{constructor(t){super("wa-select",{bubbles:!0,cancelable:!0,composed:!0}),this.detail=t}};function*Qo(t=document.activeElement){t!=null&&(yield t,"shadowRoot"in t&&t.shadowRoot&&t.shadowRoot.mode!=="closed"&&(yield*Qo(t.shadowRoot.activeElement)))}function Al(){return[...Qo()].pop()}var _l=C`
  :host {
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);
    display: contents;
  }

  #menu {
    display: flex;
    flex-direction: column;
    width: max-content;
    margin: 0;
    padding: 0.25em;
    border: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    background-color: var(--wa-color-surface-raised);
    box-shadow: var(--wa-shadow-m);
    color: var(--wa-color-text-normal);
    text-align: start;
    user-select: none;
    overflow: auto;
    max-width: var(--auto-size-available-width) !important;
    max-height: var(--auto-size-available-height) !important;

    &.show {
      animation: show var(--show-duration) ease;
    }

    &.hide {
      animation: show var(--hide-duration) ease reverse;
    }

    ::slotted(h1),
    ::slotted(h2),
    ::slotted(h3),
    ::slotted(h4),
    ::slotted(h5),
    ::slotted(h6) {
      display: block !important;
      margin: 0.25em 0 !important;
      padding: 0.25em 0.75em !important;
      color: var(--wa-color-text-quiet);
      font-family: var(--wa-font-family-body) !important;
      font-weight: var(--wa-font-weight-semibold) !important;
      font-size: var(--wa-font-size-smaller) !important;
    }

    ::slotted(wa-divider) {
      --spacing: 0.25em; /* Component-specific, left as-is */
    }
  }

  wa-popup[data-current-placement^='top'] #menu {
    transform-origin: bottom;
  }

  wa-popup[data-current-placement^='bottom'] #menu {
    transform-origin: top;
  }

  wa-popup[data-current-placement^='left'] #menu {
    transform-origin: right;
  }

  wa-popup[data-current-placement^='right'] #menu {
    transform-origin: left;
  }

  wa-popup[data-current-placement='left-start'] #menu {
    transform-origin: right top;
  }

  wa-popup[data-current-placement='left-end'] #menu {
    transform-origin: right bottom;
  }

  wa-popup[data-current-placement='right-start'] #menu {
    transform-origin: left top;
  }

  wa-popup[data-current-placement='right-end'] #menu {
    transform-origin: left bottom;
  }

  @keyframes show {
    from {
      scale: 0.9;
      opacity: 0;
    }
    to {
      scale: 1;
      opacity: 1;
    }
  }
`;var Da=new Set,Yt=class extends E{constructor(){super(...arguments),this.submenuCleanups=new Map,this.localize=new I(this),this.userTypedQuery="",this.openSubmenuStack=[],this.open=!1,this.size="m",this.placement="bottom-start",this.distance=0,this.skidding=0,this.handleDocumentKeyDown=async t=>{let e=this.localize.dir()==="rtl";if(t.key==="Escape"&&this.open&&Dt(this)){let u=this.getTrigger();t.preventDefault(),t.stopPropagation(),this.open=!1,u?.focus({preventScroll:!0});return}let o=[...Qo()].find(u=>u.localName==="wa-dropdown-item"),i=o?.localName==="wa-dropdown-item",r=this.getCurrentSubmenuItem(),s=!!r,n,c,h;s?(n=this.getSubmenuItems(r),c=n.find(u=>u.active||u===o),h=c?n.indexOf(c):-1):(n=this.getItems(),c=n.find(u=>u.active||u===o),h=c?n.indexOf(c):-1);let d;if(t.key==="ArrowUp"&&(t.preventDefault(),t.stopPropagation(),h>0?d=n[h-1]:d=n[n.length-1]),t.key==="ArrowDown"&&(t.preventDefault(),t.stopPropagation(),h!==-1&&h<n.length-1?d=n[h+1]:d=n[0]),t.key===(e?"ArrowLeft":"ArrowRight")&&i&&c&&c.hasSubmenu){t.preventDefault(),t.stopPropagation(),c.submenuOpen=!0,this.addToSubmenuStack(c),setTimeout(()=>{let u=this.getSubmenuItems(c);u.length>0&&(u.forEach((b,f)=>b.active=f===0),u[0].focus({preventScroll:!0}))},0);return}if(t.key===(e?"ArrowRight":"ArrowLeft")&&s){t.preventDefault(),t.stopPropagation();let u=this.removeFromSubmenuStack();u&&(u.submenuOpen=!1,setTimeout(()=>{u.focus({preventScroll:!0}),u.active=!0,(u.slot==="submenu"?this.getSubmenuItems(u.parentElement):this.getItems()).forEach(f=>{f!==u&&(f.active=!1)})},0));return}if((t.key==="Home"||t.key==="End")&&(t.preventDefault(),t.stopPropagation(),d=t.key==="Home"?n[0]:n[n.length-1]),t.key==="Tab"&&await this.hideMenu(),t.key.length===1&&!(t.metaKey||t.ctrlKey||t.altKey)&&!(t.key===" "&&this.userTypedQuery==="")&&(clearTimeout(this.userTypedTimeout),this.userTypedTimeout=setTimeout(()=>{this.userTypedQuery=""},1e3),this.userTypedQuery+=t.key,n.some(u=>{let b=(u.textContent||"").trim().toLowerCase(),f=this.userTypedQuery.trim().toLowerCase();return b.startsWith(f)?(d=u,!0):!1})),d){t.preventDefault(),t.stopPropagation(),n.forEach(u=>u.active=u===d),d.focus({preventScroll:!0}),d.scrollIntoView({block:"nearest"});return}(t.key==="Enter"||t.key===" "&&this.userTypedQuery==="")&&i&&c&&(t.preventDefault(),t.stopPropagation(),c.hasSubmenu?(c.submenuOpen=!0,this.addToSubmenuStack(c),setTimeout(()=>{let u=this.getSubmenuItems(c);u.length>0&&(u.forEach((b,f)=>b.active=f===0),u[0].focus({preventScroll:!0}))},0)):this.makeSelection(c))},this.handleDocumentPointerDown=t=>{t.composedPath().some(i=>i instanceof HTMLElement?i===this||i.closest('wa-dropdown, [part="submenu"]'):!1)||(this.open=!1)},this.handleGlobalMouseMove=t=>{let e=this.getCurrentSubmenuItem();if(!e?.submenuOpen||!e.submenuElement)return;let o=e.submenuElement.getBoundingClientRect(),i=this.localize.dir()==="rtl",r=i?o.right:o.left,s=i?Math.max(t.clientX,r):Math.min(t.clientX,r),n=Math.max(o.top,Math.min(t.clientY,o.bottom));e.submenuElement.style.setProperty("--safe-triangle-cursor-x",`${s}px`),e.submenuElement.style.setProperty("--safe-triangle-cursor-y",`${n}px`);let c=t.composedPath(),h=e.matches(":hover"),d=!!e.submenuElement?.matches(":hover"),u=h||!!c.find(f=>f===e),b=d||!!c.find(f=>f instanceof HTMLElement&&f.closest('[part="submenu"]')===e.submenuElement);!u&&!b&&setTimeout(()=>{!h&&!d&&(e.submenuOpen=!1)},100)}}handleSizeChange(){U(this.localName,this.size)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this.userTypedTimeout),this.closeAllSubmenus(),this.submenuCleanups.forEach(t=>t()),this.submenuCleanups.clear(),document.removeEventListener("mousemove",this.handleGlobalMouseMove),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("pointerdown",this.handleDocumentPointerDown),It(this)}firstUpdated(){this.syncAriaAttributes()}async updated(t){if(t.has("open")){let e=t.get("open");if(e===this.open||e===void 0&&this.open===!1)return;this.customStates.set("open",this.open),this.open?await this.showMenu():(this.closeAllSubmenus(),await this.hideMenu())}t.has("size")&&this.syncItemSizes()}getItems(t=!1){let e=(this.defaultSlot?.assignedElements({flatten:!0})??[]).filter(o=>o.localName==="wa-dropdown-item");return t?e:e.filter(o=>!o.disabled)}getSubmenuItems(t,e=!1){let o=t.shadowRoot?.querySelector('slot[name="submenu"]')||t.querySelector('slot[name="submenu"]');if(!o)return[];let i=o.assignedElements({flatten:!0}).filter(r=>r.localName==="wa-dropdown-item");return e?i:i.filter(r=>!r.disabled)}syncItemSizes(){(this.defaultSlot?.assignedElements({flatten:!0})??[]).filter(e=>e.localName==="wa-dropdown-item").forEach(e=>e.size=this.size)}addToSubmenuStack(t){let e=this.openSubmenuStack.indexOf(t);e!==-1?this.openSubmenuStack=this.openSubmenuStack.slice(0,e+1):this.openSubmenuStack.push(t)}removeFromSubmenuStack(){return this.openSubmenuStack.pop()}getCurrentSubmenuItem(){return this.openSubmenuStack.length>0?this.openSubmenuStack[this.openSubmenuStack.length-1]:void 0}closeAllSubmenus(){this.getItems(!0).forEach(e=>{e.submenuOpen=!1}),this.openSubmenuStack=[]}closeSiblingSubmenus(t){let e=t.closest('wa-dropdown-item:not([slot="submenu"])'),o;e?o=this.getSubmenuItems(e,!0):o=this.getItems(!0),o.forEach(i=>{i!==t&&i.submenuOpen&&(i.submenuOpen=!1)}),this.openSubmenuStack.includes(t)||this.openSubmenuStack.push(t)}getTrigger(){return this.querySelector('[slot="trigger"]')}async showMenu(){if(!this.getTrigger()||!this.popup||!this.menu)return;let e=new Bt;if(this.dispatchEvent(e),e.defaultPrevented){this.open=!1;return}if(this.popup.active)return;Da.forEach(i=>i.open=!1),this.popup.active=!0,this.open=!0,Da.add(this),Kt(this),this.syncAriaAttributes(),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("pointerdown",this.handleDocumentPointerDown),document.addEventListener("mousemove",this.handleGlobalMouseMove),this.menu.classList.remove("hide"),await G(this.menu,"show");let o=this.getItems();o.length>0&&(o.forEach((i,r)=>i.active=r===0),o[0].focus({preventScroll:!0})),this.dispatchEvent(new Vt)}async hideMenu(){if(!this.popup||!this.menu)return;let t=new Ft({source:this});if(this.dispatchEvent(t),t.defaultPrevented){this.open=!0;return}this.open=!1,Da.delete(this),It(this),this.syncAriaAttributes(),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("pointerdown",this.handleDocumentPointerDown),document.removeEventListener("mousemove",this.handleGlobalMouseMove),this.menu.classList.remove("show"),await G(this.menu,"hide"),this.popup.active=this.open,this.dispatchEvent(new qt)}handleMenuClick(t){let e=t.target.closest("wa-dropdown-item");if(!(!e||e.disabled)){if(e.hasSubmenu){e.submenuOpen||(this.closeSiblingSubmenus(e),this.addToSubmenuStack(e),e.submenuOpen=!0),t.stopPropagation();return}this.makeSelection(e)}}async handleMenuSlotChange(){let t=this.getItems(!0);await Promise.all(t.map(i=>i.updateComplete)),this.syncItemSizes();let e=t.some(i=>i.type==="checkbox"),o=t.some(i=>i.hasSubmenu);t.forEach((i,r)=>{i.active=r===0,i.checkboxAdjacent=e,i.submenuAdjacent=o})}handleTriggerClick(){this.open=!this.open}handleSubmenuOpening(t){let e=t.detail.item;this.closeSiblingSubmenus(e),this.addToSubmenuStack(e),this.setupSubmenuPosition(e),this.processSubmenuItems(e)}setupSubmenuPosition(t){if(!t.submenuElement)return;this.cleanupSubmenuPosition(t);let e=vr(t,t.submenuElement,()=>{this.positionSubmenu(t),this.updateSafeTriangleCoordinates(t)});this.submenuCleanups.set(t,e);let o=t.submenuElement.querySelector('slot[name="submenu"]');o&&(o.removeEventListener("slotchange",Yt.handleSubmenuSlotChange),o.addEventListener("slotchange",Yt.handleSubmenuSlotChange),Yt.handleSubmenuSlotChange({target:o}))}static handleSubmenuSlotChange(t){let e=t.target;if(!e)return;let o=e.assignedElements().filter(s=>s.localName==="wa-dropdown-item");if(o.length===0)return;let i=o.some(s=>s.hasSubmenu),r=o.some(s=>s.type==="checkbox");o.forEach(s=>{s.submenuAdjacent=i,s.checkboxAdjacent=r})}processSubmenuItems(t){if(!t.submenuElement)return;let e=this.getSubmenuItems(t,!0),o=e.some(i=>i.hasSubmenu);e.forEach(i=>{i.submenuAdjacent=o})}cleanupSubmenuPosition(t){let e=this.submenuCleanups.get(t);e&&(e(),this.submenuCleanups.delete(t))}positionSubmenu(t){if(!t.submenuElement)return;let o=this.localize.dir()==="rtl"?"left-start":"right-start";Cr(t,t.submenuElement,{placement:o,middleware:[wr({mainAxis:0,crossAxis:-5}),xr({fallbackStrategy:"bestFit"}),yr({padding:8})]}).then(({x:i,y:r,placement:s})=>{t.submenuElement.setAttribute("data-placement",s),Object.assign(t.submenuElement.style,{left:`${i}px`,top:`${r}px`})})}updateSafeTriangleCoordinates(t){if(!t.submenuElement||!t.submenuOpen)return;if(document.activeElement?.matches(":focus-visible")){t.submenuElement.style.setProperty("--safe-triangle-visible","none");return}t.submenuElement.style.setProperty("--safe-triangle-visible","block");let o=t.submenuElement.getBoundingClientRect(),i=this.localize.dir()==="rtl";t.submenuElement.style.setProperty("--safe-triangle-submenu-start-x",`${i?o.right:o.left}px`),t.submenuElement.style.setProperty("--safe-triangle-submenu-start-y",`${o.top}px`),t.submenuElement.style.setProperty("--safe-triangle-submenu-end-x",`${i?o.right:o.left}px`),t.submenuElement.style.setProperty("--safe-triangle-submenu-end-y",`${o.bottom}px`)}makeSelection(t){let e=this.getTrigger();if(t.disabled)return;t.type==="checkbox"&&(t.checked=!t.checked);let o=new $l({item:t});this.dispatchEvent(o),o.defaultPrevented||(this.open=!1,e?.focus({preventScroll:!0}))}async syncAriaAttributes(){let t=this.getTrigger(),e;t&&(t.localName==="wa-button"?(await customElements.whenDefined("wa-button"),await t.updateComplete,e=t.shadowRoot.querySelector('[part~="base"]')):e=t,e.hasAttribute("id")||e.setAttribute("id",ee("wa-dropdown-trigger-")),e.setAttribute("aria-haspopup","menu"),e.setAttribute("aria-expanded",this.open?"true":"false"),this.menu?.setAttribute("aria-expanded","false"))}render(){let t=this.didSSR&&!this.hasUpdated?this.open:this.popup?.active;return p`
      <wa-popup
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        ?active=${t}
        flip
        flip-fallback-strategy="best-fit"
        shift
        shift-padding="10"
        auto-size="vertical"
        auto-size-padding="10"
      >
        <slot
          name="trigger"
          slot="anchor"
          @click=${this.handleTriggerClick}
          @slotchange=${this.syncAriaAttributes}
        ></slot>
        <div
          id="menu"
          part="menu"
          role="menu"
          tabindex="-1"
          aria-orientation="vertical"
          @click=${this.handleMenuClick}
          @submenu-opening=${this.handleSubmenuOpening}
        >
          <slot @slotchange=${this.handleMenuSlotChange}></slot>
        </div>
      </wa-popup>
    `}};Yt.css=[j,_l];a([S("slot:not([name])")],Yt.prototype,"defaultSlot",2);a([S("#menu")],Yt.prototype,"menu",2);a([S("wa-popup")],Yt.prototype,"popup",2);a([l({type:Boolean,reflect:!0})],Yt.prototype,"open",2);a([l({reflect:!0})],Yt.prototype,"size",2);a([y("size")],Yt.prototype,"handleSizeChange",1);a([l({reflect:!0})],Yt.prototype,"placement",2);a([l({type:Number})],Yt.prototype,"distance",2);a([l({type:Number})],Yt.prototype,"skidding",2);Yt=a([k("wa-dropdown")],Yt);var Tl=C`
  :host {
    display: flex;
    position: relative;
    align-items: center;
    padding: 0.5em 1em;
    border-radius: var(--wa-border-radius-s);
    isolation: isolate;
    color: var(--wa-color-text-normal);
    line-height: var(--wa-line-height-condensed);
    cursor: pointer;
    transition:
      var(--wa-transition-fast) background-color var(--wa-transition-easing),
      var(--wa-transition-fast) color var(--wa-transition-easing);
  }

  @media (hover: hover) {
    :host(:hover:not(:state(disabled))) {
      background-color: var(--wa-color-neutral-fill-normal);
    }
  }

  :host(:state(submenu-open)) {
    background-color: var(--wa-color-neutral-fill-normal);
  }

  :host(:focus-visible) {
    z-index: 1;
    outline: var(--wa-focus-ring);
    background-color: var(--wa-color-neutral-fill-normal);
  }

  :host(:state(disabled)),
  :host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Danger variant */
  :host([variant='danger']),
  :host([variant='danger']) #details {
    color: var(--wa-color-danger-on-quiet);
  }

  @media (hover: hover) {
    :host([variant='danger']:hover) {
      background-color: var(--wa-color-danger-fill-normal);
      color: var(--wa-color-danger-on-normal);
    }
  }

  :host([variant='danger']:state(submenu-open)),
  :host([variant='danger']:focus-visible) {
    background-color: var(--wa-color-danger-fill-normal);
    color: var(--wa-color-danger-on-normal);
  }

  :host([checkbox-adjacent]) {
    padding-inline-start: 2em;
  }

  /* Only add padding when item actually has a submenu */
  :host([submenu-adjacent]:not(:state(has-submenu))) #details {
    padding-inline-end: 0;
  }

  :host(:state(has-submenu)[submenu-adjacent]) #details {
    padding-inline-end: 1.75em;
  }

  #check {
    visibility: hidden;
    margin-inline-start: -1.5em;
    margin-inline-end: 0.5em;
    font-size: var(--wa-font-size-smaller);
  }

  :host(:state(checked)) #check {
    visibility: visible;
  }

  #icon ::slotted(*) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    margin-inline-end: 0.75em !important;
    font-size: var(--wa-font-size-smaller);
  }

  #label {
    flex: 1 1 auto;
    min-width: 0;
  }

  #details {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: end;
    color: var(--wa-color-text-quiet);
    font-size: var(--wa-font-size-smaller) !important;
  }

  #details ::slotted(*) {
    margin-inline-start: 2em !important;
  }

  /* Submenu indicator icon */
  #submenu-indicator {
    position: absolute;
    inset-inline-end: 1em;
    color: var(--wa-color-neutral-on-quiet);
    font-size: var(--wa-font-size-smaller);
  }

  /* Flip chevron icon when RTL */
  :host(:dir(rtl)) #submenu-indicator {
    transform: scaleX(-1);
  }

  /* Submenu styles */
  #submenu {
    display: flex;
    z-index: 10;
    position: absolute;
    top: 0;
    left: 0;
    flex-direction: column;
    width: max-content;
    margin: 0;
    padding: 0.25em;
    border: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    background-color: var(--wa-color-surface-raised);
    box-shadow: var(--wa-shadow-m);
    color: var(--wa-color-text-normal);
    text-align: start;
    user-select: none;

    /* Override default popover styles */
    &[popover] {
      margin: 0;
      inset: auto;
      padding: 0.25em;
      overflow: visible;
      border-radius: var(--wa-border-radius-m);
    }

    &.show {
      animation: submenu-show var(--show-duration, var(--wa-transition-fast)) ease;
    }

    &.hide {
      animation: submenu-show var(--show-duration, var(--wa-transition-fast)) ease reverse;
    }

    /* Submenu placement transform origins */
    &[data-placement^='top'] {
      transform-origin: bottom;
    }

    &[data-placement^='bottom'] {
      transform-origin: top;
    }

    &[data-placement^='left'] {
      transform-origin: right;
    }

    &[data-placement^='right'] {
      transform-origin: left;
    }

    &[data-placement='left-start'] {
      transform-origin: right top;
    }

    &[data-placement='left-end'] {
      transform-origin: right bottom;
    }

    &[data-placement='right-start'] {
      transform-origin: left top;
    }

    &[data-placement='right-end'] {
      transform-origin: left bottom;
    }

    /* Safe triangle styling */
    &::before {
      display: none;
      z-index: 9;
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background-color: transparent;
      content: '';
      clip-path: polygon(
        var(--safe-triangle-cursor-x, 0) var(--safe-triangle-cursor-y, 0),
        var(--safe-triangle-submenu-start-x, 0) var(--safe-triangle-submenu-start-y, 0),
        var(--safe-triangle-submenu-end-x, 0) var(--safe-triangle-submenu-end-y, 0)
      );
      pointer-events: auto; /* Enable mouse events on the triangle */
    }

    &[data-visible]::before {
      display: block;
    }
  }

  ::slotted(wa-dropdown-item) {
    font-size: inherit;
  }

  ::slotted(wa-divider) {
    --spacing: 0.25em;
  }

  @keyframes submenu-show {
    from {
      scale: 0.9;
      opacity: 0;
    }
    to {
      scale: 1;
      opacity: 1;
    }
  }
`;var Ht=class extends E{constructor(){super(...arguments),this.hasSlotController=new Z(this,"[default]","start","end"),this.active=!1,this.variant="default",this.size="m",this.checkboxAdjacent=!1,this.submenuAdjacent=!1,this.type="normal",this.checked=!1,this.disabled=!1,this.submenuOpen=!1,this.hasSubmenu=!1,this.handleSlotChange=()=>{this.hasSubmenu=this.hasSlotController.test("submenu"),this.updateHasSubmenuState(),this.hasSubmenu?(this.setAttribute("aria-haspopup","menu"),this.setAttribute("aria-expanded",this.submenuOpen?"true":"false")):(this.removeAttribute("aria-haspopup"),this.removeAttribute("aria-expanded"))},this.handleHostClick=t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation())},this.handleClick=t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation())}}handleSizeChange(){U(this.localName,this.size)}connectedCallback(){super.connectedCallback(),this.addEventListener?.("click",this.handleHostClick),this.addEventListener?.("mouseenter",this.handleMouseEnter.bind(this)),this.shadowRoot?.addEventListener?.("click",this.handleClick,{capture:!0}),this.shadowRoot?.addEventListener?.("slotchange",this.handleSlotChange)}disconnectedCallback(){super.disconnectedCallback(),this.closeSubmenu(),this.removeEventListener?.("click",this.handleHostClick),this.removeEventListener?.("mouseenter",this.handleMouseEnter),this.shadowRoot?.removeEventListener?.("click",this.handleClick,{capture:!0}),this.shadowRoot?.removeEventListener?.("slotchange",this.handleSlotChange)}firstUpdated(){this.setAttribute("tabindex","-1"),this.hasSubmenu=this.hasSlotController.test("submenu"),this.updateHasSubmenuState()}updated(t){t.has("active")&&(this.setAttribute("tabindex",this.active?"0":"-1"),this.customStates.set("active",this.active)),t.has("checked")&&(this.type==="checkbox"?this.setAttribute("aria-checked",this.checked?"true":"false"):this.removeAttribute("aria-checked"),this.customStates.set("checked",this.checked)),t.has("disabled")&&(this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.customStates.set("disabled",this.disabled)),t.has("type")&&(this.type==="checkbox"?(this.setAttribute("role","menuitemcheckbox"),this.setAttribute("aria-checked",this.checked?"true":"false")):(this.setAttribute("role","menuitem"),this.removeAttribute("aria-checked"))),t.has("submenuOpen")&&(this.customStates.set("submenu-open",this.submenuOpen),this.submenuOpen?this.openSubmenu():this.closeSubmenu())}updateHasSubmenuState(){this.customStates.set("has-submenu",this.hasSubmenu)}async openSubmenu(){let t=this.submenuElement;!this.hasSubmenu||!t||!this.isConnected||(this.notifyParentOfOpening(),t.showPopover?.(),t.hidden=!1,t.setAttribute("data-visible",""),this.submenuOpen=!0,this.setAttribute("aria-expanded","true"),await G(t,"show"),setTimeout(()=>{let e=this.getSubmenuItems();e.length>0&&(e.forEach((o,i)=>o.active=i===0),e[0].focus({preventScroll:!0}))},0))}notifyParentOfOpening(){let t=new CustomEvent("submenu-opening",{bubbles:!0,composed:!0,detail:{item:this}});this.dispatchEvent(t);let e=this.parentElement;e&&[...e.children].filter(i=>i!==this&&i.localName==="wa-dropdown-item"&&i.getAttribute("slot")===this.getAttribute("slot")&&i.submenuOpen).forEach(i=>{i.submenuOpen=!1})}async closeSubmenu(){let t=this.submenuElement;!this.hasSubmenu||!t||(this.submenuOpen=!1,this.setAttribute("aria-expanded","false"),t.hidden||(await G(t,"hide"),t?.isConnected&&(t.hidden=!0,t.removeAttribute("data-visible"),t.hidePopover?.())))}getSubmenuItems(){return[...this.children].filter(t=>t.localName==="wa-dropdown-item"&&t.getAttribute("slot")==="submenu"&&!t.hasAttribute("disabled"))}handleMouseEnter(){this.hasSubmenu&&!this.disabled&&(this.notifyParentOfOpening(),this.submenuOpen=!0)}render(){return p`
      ${this.type==="checkbox"?p`
            <wa-icon
              id="check"
              part="checkmark"
              exportparts="svg:checkmark__svg"
              library="system"
              name="check"
            ></wa-icon>
          `:""}

      <span id="icon" part="icon">
        <slot name="icon"></slot>
      </span>

      <span id="label" part="label">
        <slot></slot>
      </span>

      <span id="details" part="details">
        <slot name="details"></slot>
      </span>

      ${this.hasSubmenu?p`
            <wa-icon
              id="submenu-indicator"
              part="submenu-icon"
              exportparts="svg:submenu-icon__svg"
              library="system"
              name="chevron-right"
            ></wa-icon>
          `:""}
      ${this.hasSubmenu?p`
            <div
              id="submenu"
              part="submenu"
              popover="manual"
              role="menu"
              tabindex="-1"
              aria-orientation="vertical"
              hidden
            >
              <slot name="submenu"></slot>
            </div>
          `:""}
    `}};Ht.css=Tl;a([S("#submenu")],Ht.prototype,"submenuElement",2);a([l({type:Boolean})],Ht.prototype,"active",2);a([l({reflect:!0})],Ht.prototype,"variant",2);a([l({reflect:!0})],Ht.prototype,"size",2);a([y("size")],Ht.prototype,"handleSizeChange",1);a([l({attribute:"checkbox-adjacent",type:Boolean,reflect:!0})],Ht.prototype,"checkboxAdjacent",2);a([l({attribute:"submenu-adjacent",type:Boolean,reflect:!0})],Ht.prototype,"submenuAdjacent",2);a([l()],Ht.prototype,"value",2);a([l({reflect:!0})],Ht.prototype,"type",2);a([l({type:Boolean})],Ht.prototype,"checked",2);a([l({type:Boolean,reflect:!0})],Ht.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],Ht.prototype,"submenuOpen",2);a([A()],Ht.prototype,"hasSubmenu",2);Ht=a([k("wa-dropdown-item")],Ht);var Jo=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.value=0,this.unit="byte",this.display="short"}static get styles(){return[]}render(){if(isNaN(this.value))return"";let t=["","kilo","mega","giga","tera"],e=["","kilo","mega","giga","tera","peta"],o=this.unit==="bit"?t:e,i=Math.max(0,Math.min(Math.floor(Math.log10(this.value)/3),o.length-1)),r=o[i]+this.unit,s=parseFloat((this.value/Math.pow(1e3,i)).toPrecision(3));return this.localize.number(s,{style:"unit",unit:r,unitDisplay:this.display})}};a([l({type:Number})],Jo.prototype,"value",2);a([l()],Jo.prototype,"unit",2);a([l()],Jo.prototype,"display",2);Jo=a([k("wa-format-bytes")],Jo);var Jt=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.date=new Date,this.hourFormat="auto"}static get styles(){return[]}render(){let t=new Date(this.date),e=this.hourFormat==="auto"?void 0:this.hourFormat==="12";if(isNaN(t.getMilliseconds()))return;let o=this.localize.date(t,{weekday:this.weekday,era:this.era,year:this.year,month:this.month,day:this.day,hour:this.hour,minute:this.minute,second:this.second,timeZoneName:this.timeZoneName,timeZone:this.timeZone,hour12:e});return p`<time datetime=${t.toISOString()}>${o}</time>`}};a([l()],Jt.prototype,"date",2);a([l()],Jt.prototype,"weekday",2);a([l()],Jt.prototype,"era",2);a([l()],Jt.prototype,"year",2);a([l()],Jt.prototype,"month",2);a([l()],Jt.prototype,"day",2);a([l()],Jt.prototype,"hour",2);a([l()],Jt.prototype,"minute",2);a([l()],Jt.prototype,"second",2);a([l({attribute:"time-zone-name"})],Jt.prototype,"timeZoneName",2);a([l({attribute:"time-zone"})],Jt.prototype,"timeZone",2);a([l({attribute:"hour-format"})],Jt.prototype,"hourFormat",2);Jt=a([k("wa-format-date")],Jt);var ce=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.value=0,this.type="decimal",this.withoutGrouping=!1,this.currency="USD",this.currencyDisplay="symbol"}static get styles(){return[]}render(){return isNaN(this.value)?"":this.localize.number(this.value,{style:this.type,currency:this.currency,currencyDisplay:this.currencyDisplay,useGrouping:!this.withoutGrouping,minimumIntegerDigits:this.minimumIntegerDigits,minimumFractionDigits:this.minimumFractionDigits,maximumFractionDigits:this.maximumFractionDigits,minimumSignificantDigits:this.minimumSignificantDigits,maximumSignificantDigits:this.maximumSignificantDigits})}};a([l({type:Number})],ce.prototype,"value",2);a([l()],ce.prototype,"type",2);a([l({attribute:"without-grouping",type:Boolean})],ce.prototype,"withoutGrouping",2);a([l()],ce.prototype,"currency",2);a([l({attribute:"currency-display"})],ce.prototype,"currencyDisplay",2);a([l({attribute:"minimum-integer-digits",type:Number})],ce.prototype,"minimumIntegerDigits",2);a([l({attribute:"minimum-fraction-digits",type:Number})],ce.prototype,"minimumFractionDigits",2);a([l({attribute:"maximum-fraction-digits",type:Number})],ce.prototype,"maximumFractionDigits",2);a([l({attribute:"minimum-significant-digits",type:Number})],ce.prototype,"minimumSignificantDigits",2);a([l({attribute:"maximum-significant-digits",type:Number})],ce.prototype,"maximumSignificantDigits",2);ce=a([k("wa-format-number")],ce);var zr=class extends Event{constructor(t){super("wa-include-error",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Ml=C`
  :host {
    display: block;
  }
`;var Ra=new Map;function Il(t,e="cors"){let o=Ra.get(t);if(o!==void 0)return Promise.resolve(o);let i=fetch(t,{mode:e}).then(async r=>{let s={ok:r.ok,status:r.status,html:await r.text()};return Ra.set(t,s),s});return Ra.set(t,i),i}var vo=class extends E{constructor(){super(...arguments),this.mode="cors",this.allowScripts=!1}executeScript(t){let e=document.createElement("script");[...t.attributes].forEach(o=>e.setAttribute(o.name,o.value)),e.textContent=t.textContent,t.parentNode.replaceChild(e,t)}cloneFragment(t,e){let o=t.localName==="template"?t.content:this.childNodesToFragment(t);return e.importNode(o,!0)}childNodesToFragment(t){let e=t.ownerDocument.createDocumentFragment();return t.childNodes.forEach(o=>e.append(o.cloneNode(!0))),e}async handleSrcChange(){try{let t=this.src,e=new URL(t,document.baseURI),o=e.hash.slice(1);if(t.startsWith("#")){let s=o?document.getElementById(decodeURIComponent(o)):null;s?this.replaceChildren(this.cloneFragment(s,document)):this.replaceChildren(),this.dispatchEvent(new Ao);return}let i=t;o&&(e.hash="",i=e.href);let r=await Il(i,this.mode);if(t!==this.src)return;if(!r.ok){this.dispatchEvent(new zr({status:r.status}));return}if(o){let n=new DOMParser().parseFromString(r.html,"text/html").getElementById(decodeURIComponent(o));if(!n){this.dispatchEvent(new zr({status:r.status}));return}this.replaceChildren(this.cloneFragment(n,document))}else this.innerHTML=r.html;this.allowScripts&&[...this.querySelectorAll("script")].forEach(s=>this.executeScript(s)),this.dispatchEvent(new Ao)}catch{this.dispatchEvent(new zr({status:-1}))}}render(){return p`<slot></slot>`}};vo.css=Ml;a([l()],vo.prototype,"src",2);a([l()],vo.prototype,"mode",2);a([l({attribute:"allow-scripts",type:Boolean})],vo.prototype,"allowScripts",2);a([y("src")],vo.prototype,"handleSrcChange",1);vo=a([k("wa-include")],vo);var Dl=class extends Event{constructor(t){super("wa-intersect",{bubbles:!1,cancelable:!1,composed:!0}),this.detail=t}};var Rl=C`
  :host {
    display: contents;
  }
`;var ye=class extends E{constructor(){super(...arguments),this.intersectionObserver=null,this.observedElements=new Map,this.root=null,this.rootMargin="0px",this.threshold="0",this.intersectClass="",this.once=!1,this.disabled=!1}connectedCallback(){super.connectedCallback(),this.disabled||this.updateComplete.then(()=>{this.startObserver()})}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}parseThreshold(){return bo(this.threshold).map(e=>{let o=parseFloat(e);return isNaN(o)?0:W(o,0,1)})}resolveRoot(){if(!this.root)return null;try{let e=this.getRootNode().getElementById(this.root);return e||console.warn(`Root element with ID "${this.root}" could not be found.`,this),e}catch{return console.warn(`Invalid selector for root: "${this.root}"`,this),null}}startObserver(){if(this.stopObserver(),this.disabled)return;let t=this.parseThreshold(),e=this.resolveRoot();this.intersectionObserver=new IntersectionObserver(i=>{i.forEach(r=>{let s=this.observedElements.get(r.target)??!1,n=r.isIntersecting;this.observedElements.set(r.target,n),this.intersectClass&&(n?r.target.classList.add(this.intersectClass):r.target.classList.remove(this.intersectClass));let c=new Dl({entry:r});this.dispatchEvent(c),n&&!s&&this.once&&(this.intersectionObserver?.unobserve(r.target),this.observedElements.delete(r.target))})},{root:e,rootMargin:this.rootMargin,threshold:t});let o=this.shadowRoot.querySelector("slot");o!==null&&o.assignedElements({flatten:!0}).forEach(r=>{this.intersectionObserver?.observe(r),this.observedElements.set(r,!1)})}stopObserver(){this.intersectClass&&this.observedElements.forEach((t,e)=>{e.classList.remove(this.intersectClass)}),this.intersectionObserver?.disconnect(),this.intersectionObserver=null,this.observedElements.clear()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}handleOptionsChange(){this.startObserver()}render(){return p` <slot @slotchange=${this.handleSlotChange}></slot> `}};ye.css=Rl;a([l()],ye.prototype,"root",2);a([l({attribute:"root-margin"})],ye.prototype,"rootMargin",2);a([l()],ye.prototype,"threshold",2);a([l({attribute:"intersect-class"})],ye.prototype,"intersectClass",2);a([l({type:Boolean,reflect:!0})],ye.prototype,"once",2);a([l({type:Boolean,reflect:!0})],ye.prototype,"disabled",2);a([y("disabled",{waitUntilFirstUpdate:!0})],ye.prototype,"handleDisabledChange",1);a([y("root",{waitUntilFirstUpdate:!0}),y("rootMargin",{waitUntilFirstUpdate:!0}),y("threshold",{waitUntilFirstUpdate:!0})],ye.prototype,"handleOptionsChange",1);ye=a([k("wa-intersection-observer")],ye);var Pl=new Map;function Ol(t){let e=t||"en",o=Pl.get(e);if(o)return o;let r=new Intl.DateTimeFormat(e,{year:"numeric",month:"2-digit",day:"2-digit",calendar:"gregory",numberingSystem:"latn"}).formatToParts(new Date(2026,0,23)),s=[];for(let c of r)(c.type==="year"||c.type==="month"||c.type==="day")&&s.push(c.type);let n=s.length===3?s:["month","day","year"];return Pl.set(e,n),n}var Bl=()=>({checkValidity(t){let e=t,o=e.parts;if(o.day===""&&o.month===""&&o.year==="")return{isValid:!0,invalidKeys:[],message:""};if(e.value===""){let r=e.localize?.term("incompleteDate")||"Enter a valid date.";return{isValid:!1,invalidKeys:["badInput"],message:r}}return{isValid:!0,invalidKeys:[],message:""}}});var Er={day:"",month:"",year:""};function vu(t){return t.day!==""&&t.month!==""&&t.year!==""}function Pa(t){if(!vu(t))return"";let e=Number(t.year),o=Number(t.month),i=Number(t.day);if(!Number.isInteger(e)||e<1||e>9999||!Number.isInteger(o)||o<1||o>12||!Number.isInteger(i)||i<1||i>31)return"";let r=new Date(2e3,o-1,i);return r.setFullYear(e),r.getFullYear()!==e||r.getMonth()!==o-1||r.getDate()!==i?"":`${String(e).padStart(4,"0")}-${String(o).padStart(2,"0")}-${String(i).padStart(2,"0")}`}function Oa(t){if(!t)return{...Er};let e=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);return e?{year:e[1],month:e[2],day:e[3]}:{...Er}}var Fl=C`
  :host {
    display: block;
    container-type: inline-size;
    container-name: known-date;
  }

  [part~='fieldset'],
  .fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-inline-size: 0;
  }

  legend[part~='legend'] {
    padding: 0;
    display: block;
  }

  /* The legend's inner span carries the form-control-label part so the existing form-control styles
     (including the required asterisk) apply consistently across browsers. */
  .label {
    display: inline-block;
  }

  [part~='fields'] {
    display: flex;
    gap: var(--wa-space-xs);
    align-items: start;
    inline-size: 100%;
    min-inline-size: 0;
  }

  [part~='field'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-inline-size: 0;
  }

  /* Day and month each hold two digits; year holds four. Bias the flex distribution so the year
     field gets roughly twice the share of the row but all three still grow and shrink together. */
  [part~='field-month'],
  [part~='field-day'] {
    min-inline-size: 2.5em;
  }

  [part~='field-year'] {
    flex-grow: 2;
    min-inline-size: 6em;
  }

  /* Per-field labels match the hint's typography and spacing exactly (the same 0.5em offset other
     form controls use between their input and hint) so the gap below each input reads as native. */
  [part~='field-label'] {
    color: var(--wa-form-control-hint-color);
    font-weight: var(--wa-form-control-hint-font-weight);
    line-height: var(--wa-form-control-hint-line-height);
    font-size: var(--wa-font-size-smaller);
    margin-block-start: 0.5em;
  }

  /* Each input is styled to match wa-input's .text-field wrapper directly — same border, height,
     padding, focus ring, and appearance variants. The host doesn't compose wa-input instances because
     we want three discrete native inputs (no clear/password slots, simpler DOM), but the visual contract
     is identical. */
  [part~='field-input'] {
    -webkit-appearance: none;
    appearance: none;
    box-sizing: border-box;
    height: var(--wa-form-control-height);
    inline-size: 100%;
    min-inline-size: 0;
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    background-color: var(--wa-form-control-background-color);
    color: var(--wa-form-control-value-color);
    font-family: inherit;
    font-size: var(--wa-form-control-value-font-size);
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    padding: 0 var(--wa-form-control-padding-inline);
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
  }

  [part~='field-input']:focus {
    outline-color: var(--wa-color-focus);
  }

  /* When the fields row gets too narrow to comfortably hold three side-by-side inputs, stack them
     vertically. The threshold reflects the smallest width at which all three inputs still fit a
     four-digit year plus padding without truncation. */
  @container known-date (inline-size < 300px) {
    [part~='fields'] {
      flex-direction: column;
      align-items: stretch;
    }
  }

  /* Suppress the native number spin buttons so a paste that briefly looks like a number can't show them. */
  [part~='field-input']::-webkit-outer-spin-button,
  [part~='field-input']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Hide the mirror used for native form-data + constraint validation. */
  .value-input {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    opacity: 0;
    pointer-events: none;
    border: 0;
    padding: 0;
    margin: 0;
    clip: rect(0 0 0 0);
    overflow: hidden;
  }

  /* Appearances — mirror wa-input's .text-field appearance variants exactly. */
  :host([appearance='outlined']) [part~='field-input'] {
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
  }

  :host([appearance='filled']) [part~='field-input'] {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-neutral-fill-quiet);
  }

  :host([appearance='filled-outlined']) [part~='field-input'] {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-form-control-border-color);
  }

  :host([pill]) [part~='field-input'] {
    border-radius: var(--wa-border-radius-pill) !important;
  }

  /* Disabled — mirror wa-input's :has(:disabled) opacity treatment. */
  :host(:state(disabled)) [part~='field'],
  [part~='field-input']:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;var wu=()=>ee("wa-known-date-"),vt=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["input"],this.localize=new I(this),this.hasSlotController=new Z(this,"hint","label"),this.groupId=wu(),this.hintId=`${this.groupId}-hint`,this.lastEmittedValue="",this.pendingValue=null,this.parts={...Er},this.name="",this._value="",this.defaultValue=this.getAttribute("value")??"",this.disabled=!1,this.required=!1,this.readonly=!1,this.size="m",this.appearance="outlined",this.pill=!1,this.label="",this.hint="",this.autocomplete="",this.min="",this.max="",this.locale="",this.withLabel=!1,this.withHint=!1,this.handleFieldInput=t=>{if(this.readonly)return;let e=t.currentTarget,o=e.dataset.field,i=o==="year"?4:2,r=e.value.replace(/\D/g,"").slice(0,i);r!==e.value&&(e.value=r),this.parts={...this.parts,[o]:r},this.recomputeValue(),this.requestUpdate()}}static get validators(){let t=[Bl(),oe({validationElement:Object.assign(document.createElement("input"),{required:!0})}),jt()];return[...super.validators,...t]}get value(){return this.valueHasChanged?this._value:this._value||this.defaultValue||""}set value(t){let e=this.normalizeIncomingValue(t);if(e===this._value)return;let o=this._value;this._value=e,this.valueHasChanged=!0,this.hasUpdated?this.syncPartsFromCanonical():this.pendingValue=this._value,this.requestUpdate("value",o)}handleSizeChange(){U(this.localName,this.size)}firstUpdated(){this.pendingValue!=null?(this._value=this.pendingValue,this.pendingValue=null):!this._value&&this.defaultValue&&(this._value=this.defaultValue),this.syncPartsFromCanonical(),this.input=this.valueInput,this.updateValidity(),this.lastEmittedValue=this._value}updated(t){super.updated?.(t),t.has("value")&&this.customStates.set("blank",!this._value)}focus(t){this.firstFocusableInput()?.focus(t)}blur(){this.shadowRoot?.activeElement?.blur()}get valueAsDate(){if(!this._value)return null;let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(this._value);return t?new Date(Number(t[1]),Number(t[2])-1,Number(t[3])):null}get validationTarget(){if(!this.shadowRoot)return;let t=Array.from(this.shadowRoot.querySelectorAll('input[part~="field-input"]'));if(t.length===0)return;let e=this.firstInvalidField();if(e){let o=t.find(i=>i.dataset.field===e);if(o)return o}return t[0]}formResetCallback(){this._value=this.defaultValue,this.valueHasChanged=!1,this.syncPartsFromCanonical(),super.formResetCallback(),this.lastEmittedValue=this._value,this.requestUpdate()}formStateRestoreCallback(t){typeof t=="string"&&(this.value=t),this.updateValidity()}get resolvedLocale(){return this.locale||this.localize.lang()||"en"}fieldOrder(){return Ol(this.resolvedLocale)}normalizeIncomingValue(t){if(t==null)return"";if(t instanceof Date){let e=String(t.getFullYear()).padStart(4,"0"),o=String(t.getMonth()+1).padStart(2,"0"),i=String(t.getDate()).padStart(2,"0");return`${e}-${o}-${i}`}if(typeof t=="string"){let e=Oa(t);return Pa(e)}return""}syncPartsFromCanonical(){this.parts=Oa(this._value),this.updateHiddenInput()}updateHiddenInput(){this.valueInput&&(this.valueInput.value=this._value),this.setValue(this._value||null)}recomputeValue(){let t=this._value,e=Pa(this.parts);e!==t&&(this._value=e,this.valueHasChanged=!0,this.updateHiddenInput(),this.updateValidity()),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),e!==this.lastEmittedValue&&(this.lastEmittedValue=e,this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})))}firstFocusableInput(){if(!this.shadowRoot)return;let t=Array.from(this.shadowRoot.querySelectorAll('input[part~="field-input"]'));for(let e of this.fieldOrder())if(this.parts[e]===""){let o=t.find(i=>i.dataset.field===e);if(o)return o}return t[0]}firstInvalidField(){if(this._value)return null;let t=this.fieldOrder(),e=t.find(r=>this.parts[r]==="");if(e)return e;let o={year:r=>Number.isInteger(r)&&r>=1&&r<=9999,month:r=>Number.isInteger(r)&&r>=1&&r<=12,day:r=>Number.isInteger(r)&&r>=1&&r<=31},i=t.find(r=>!o[r](Number(this.parts[r])));return i||"day"}autocompleteFor(t){let e=this.autocomplete.trim();if(e)return e==="bday"?t==="day"?"bday-day":t==="month"?"bday-month":"bday-year":e==="off"||e==="on"||t==="year"?e:void 0}render(){let t=this.hasUpdated?this.hasSlotController.test("label"):this.withLabel,e=this.hasUpdated?this.hasSlotController.test("hint"):this.withHint,o=!!this.label||!!t,i=!!this.hint||!!e,r=this.label||this.localize.term("date")||"Date",s=!!1&&this.customStates.has("user-invalid"),n=i?this.hintId:"",c=this.fieldOrder().map(d=>this.renderField(d,n,s)),h=p`
      <div part="base known-date form-control-input fields" class="fields">${c}</div>

      <slot
        name="hint"
        part="hint"
        id=${this.hintId}
        class=${_({hint:!0,"has-slotted":i})}
        aria-hidden=${i?"false":"true"}
      >
        ${this.hint}
      </slot>
    `;return p`
      <div
        part="form-control"
        class=${_({"form-control":!0,"form-control-has-label":o})}
      >
        ${o?p`<fieldset part="fieldset" class="fieldset">
              <legend part="legend">
                <span part="form-control-label label" class="label">
                  <slot name="label">${this.label}</slot>
                </span>
              </legend>
              ${h}
            </fieldset>`:p`<div part="fieldset" class="fieldset" role="group" aria-label=${r}>${h}</div>`}

        <input
          class="value-input"
          type="date"
          tabindex="-1"
          aria-hidden="true"
          .value=${this._value}
          min=${M(this.min||void 0)}
          max=${M(this.max||void 0)}
          ?disabled=${this.disabled}
          ?required=${this.required}
        />
      </div>
    `}renderField(t,e,o){let i=`${this.groupId}-${t}`,r=this.parts[t],s=this.autocompleteFor(t),n=o?"true":void 0,c=this.localize.term(t)||(t==="day"?"Day":t==="month"?"Month":"Year");return p`
      <div part="field field-${t}" class=${_({field:!0,[`field-${t}`]:!0})}>
        <input
          id=${i}
          part="field-input"
          class="field-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength=${t==="year"?4:2}
          data-field=${t}
          autocomplete=${M(s)}
          aria-describedby=${M(e||void 0)}
          aria-invalid=${M(n)}
          aria-required=${this.required?"true":"false"}
          .value=${Mt(r)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          @input=${this.handleFieldInput}
        />
        <label part="field-label" class="field-label" for=${i}>${c}</label>
      </div>
    `}};vt.css=[j,pt,Fl];vt.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S(".value-input")],vt.prototype,"valueInput",2);a([A()],vt.prototype,"parts",2);a([l({reflect:!0})],vt.prototype,"name",2);a([A()],vt.prototype,"value",1);a([l({attribute:"value",reflect:!0})],vt.prototype,"defaultValue",2);a([l({type:Boolean})],vt.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],vt.prototype,"required",2);a([l({type:Boolean,reflect:!0})],vt.prototype,"readonly",2);a([l({reflect:!0})],vt.prototype,"size",2);a([y("size")],vt.prototype,"handleSizeChange",1);a([l({reflect:!0})],vt.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],vt.prototype,"pill",2);a([l()],vt.prototype,"label",2);a([l({attribute:"hint"})],vt.prototype,"hint",2);a([l()],vt.prototype,"autocomplete",2);a([l({reflect:!0})],vt.prototype,"min",2);a([l({reflect:!0})],vt.prototype,"max",2);a([l({reflect:!0})],vt.prototype,"locale",2);a([l({attribute:"with-label",type:Boolean})],vt.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],vt.prototype,"withHint",2);vt=a([k("wa-known-date")],vt);var Vl=C`
  :host {
    display: contents;
  }
`;function Fa(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Vo=Fa();function jl(t){Vo=t}var Kl=/[&<>"']/,yu=new RegExp(Kl.source,"g"),Xl=/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,xu=new RegExp(Xl.source,"g"),Cu={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},ql=t=>Cu[t];function he(t,e){if(e){if(Kl.test(t))return t.replace(yu,ql)}else if(Xl.test(t))return t.replace(xu,ql);return t}var ku=/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig;function Su(t){return t.replace(ku,(e,o)=>(o=o.toLowerCase(),o==="colon"?":":o.charAt(0)==="#"?o.charAt(1)==="x"?String.fromCharCode(parseInt(o.substring(2),16)):String.fromCharCode(+o.substring(1)):""))}var zu=/(^|[^\[])\^/g;function mt(t,e){let o=typeof t=="string"?t:t.source;e=e||"";let i={replace:(r,s)=>{let n=typeof s=="string"?s:s.source;return n=n.replace(zu,"$1"),o=o.replace(r,n),i},getRegex:()=>new RegExp(o,e)};return i}function Wl(t){try{t=encodeURI(t).replace(/%25/g,"%")}catch{return null}return t}var $i={exec:()=>null};function Nl(t,e){let o=t.replace(/\|/g,(s,n,c)=>{let h=!1,d=n;for(;--d>=0&&c[d]==="\\";)h=!h;return h?"|":" |"}),i=o.split(/ \|/),r=0;if(i[0].trim()||i.shift(),i.length>0&&!i[i.length-1].trim()&&i.pop(),e)if(i.length>e)i.splice(e);else for(;i.length<e;)i.push("");for(;r<i.length;r++)i[r]=i[r].trim().replace(/\\\|/g,"|");return i}function Lr(t,e,o){let i=t.length;if(i===0)return"";let r=0;for(;r<i;){let s=t.charAt(i-r-1);if(s===e&&!o)r++;else if(s!==e&&o)r++;else break}return t.slice(0,i-r)}function Eu(t,e){if(t.indexOf(e[1])===-1)return-1;let o=0;for(let i=0;i<t.length;i++)if(t[i]==="\\")i++;else if(t[i]===e[0])o++;else if(t[i]===e[1]&&(o--,o<0))return i;return-1}function Hl(t,e,o,i){let r=e.href,s=e.title?he(e.title):null,n=t[1].replace(/\\([\[\]])/g,"$1");if(t[0].charAt(0)!=="!"){i.state.inLink=!0;let c={type:"link",raw:o,href:r,title:s,text:n,tokens:i.inlineTokens(n)};return i.state.inLink=!1,c}return{type:"image",raw:o,href:r,title:s,text:he(n)}}function Lu(t,e){let o=t.match(/^(\s+)(?:```)/);if(o===null)return e;let i=o[1];return e.split(`
`).map(r=>{let s=r.match(/^\s+/);if(s===null)return r;let[n]=s;return n.length>=i.length?r.slice(i.length):r}).join(`
`)}var ei=class{options;rules;lexer;constructor(e){this.options=e||Vo}space(e){let o=this.rules.block.newline.exec(e);if(o&&o[0].length>0)return{type:"space",raw:o[0]}}code(e){let o=this.rules.block.code.exec(e);if(o){let i=o[0].replace(/^ {1,4}/gm,"");return{type:"code",raw:o[0],codeBlockStyle:"indented",text:this.options.pedantic?i:Lr(i,`
`)}}}fences(e){let o=this.rules.block.fences.exec(e);if(o){let i=o[0],r=Lu(i,o[3]||"");return{type:"code",raw:i,lang:o[2]?o[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):o[2],text:r}}}heading(e){let o=this.rules.block.heading.exec(e);if(o){let i=o[2].trim();if(/#$/.test(i)){let r=Lr(i,"#");(this.options.pedantic||!r||/ $/.test(r))&&(i=r.trim())}return{type:"heading",raw:o[0],depth:o[1].length,text:i,tokens:this.lexer.inline(i)}}}hr(e){let o=this.rules.block.hr.exec(e);if(o)return{type:"hr",raw:o[0]}}blockquote(e){let o=this.rules.block.blockquote.exec(e);if(o){let i=Lr(o[0].replace(/^ *>[ \t]?/gm,""),`
`),r=this.lexer.state.top;this.lexer.state.top=!0;let s=this.lexer.blockTokens(i);return this.lexer.state.top=r,{type:"blockquote",raw:o[0],tokens:s,text:i}}}list(e){let o=this.rules.block.list.exec(e);if(o){let i=o[1].trim(),r=i.length>1,s={type:"list",raw:"",ordered:r,start:r?+i.slice(0,-1):"",loose:!1,items:[]};i=r?`\\d{1,9}\\${i.slice(-1)}`:`\\${i}`,this.options.pedantic&&(i=r?i:"[*+-]");let n=new RegExp(`^( {0,3}${i})((?:[	 ][^\\n]*)?(?:\\n|$))`),c="",h="",d=!1;for(;e;){let u=!1;if(!(o=n.exec(e))||this.rules.block.hr.test(e))break;c=o[0],e=e.substring(c.length);let b=o[2].split(`
`,1)[0].replace(/^\t+/,w=>" ".repeat(3*w.length)),f=e.split(`
`,1)[0],g=0;this.options.pedantic?(g=2,h=b.trimStart()):(g=o[2].search(/[^ ]/),g=g>4?1:g,h=b.slice(g),g+=o[1].length);let v=!1;if(!b&&/^ *$/.test(f)&&(c+=f+`
`,e=e.substring(f.length+1),u=!0),!u){let w=new RegExp(`^ {0,${Math.min(3,g-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),x=new RegExp(`^ {0,${Math.min(3,g-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),$=new RegExp(`^ {0,${Math.min(3,g-1)}}(?:\`\`\`|~~~)`),L=new RegExp(`^ {0,${Math.min(3,g-1)}}#`);for(;e;){let T=e.split(`
`,1)[0];if(f=T,this.options.pedantic&&(f=f.replace(/^ {1,4}(?=( {4})*[^ ])/g,"  ")),$.test(f)||L.test(f)||w.test(f)||x.test(e))break;if(f.search(/[^ ]/)>=g||!f.trim())h+=`
`+f.slice(g);else{if(v||b.search(/[^ ]/)>=4||$.test(b)||L.test(b)||x.test(b))break;h+=`
`+f}!v&&!f.trim()&&(v=!0),c+=T+`
`,e=e.substring(T.length+1),b=f.slice(g)}}s.loose||(d?s.loose=!0:/\n *\n *$/.test(c)&&(d=!0));let m=null,z;this.options.gfm&&(m=/^\[[ xX]\] /.exec(h),m&&(z=m[0]!=="[ ] ",h=h.replace(/^\[[ xX]\] +/,""))),s.items.push({type:"list_item",raw:c,task:!!m,checked:z,loose:!1,text:h,tokens:[]}),s.raw+=c}s.items[s.items.length-1].raw=c.trimEnd(),s.items[s.items.length-1].text=h.trimEnd(),s.raw=s.raw.trimEnd();for(let u=0;u<s.items.length;u++)if(this.lexer.state.top=!1,s.items[u].tokens=this.lexer.blockTokens(s.items[u].text,[]),!s.loose){let b=s.items[u].tokens.filter(g=>g.type==="space"),f=b.length>0&&b.some(g=>/\n.*\n/.test(g.raw));s.loose=f}if(s.loose)for(let u=0;u<s.items.length;u++)s.items[u].loose=!0;return s}}html(e){let o=this.rules.block.html.exec(e);if(o)return{type:"html",block:!0,raw:o[0],pre:o[1]==="pre"||o[1]==="script"||o[1]==="style",text:o[0]}}def(e){let o=this.rules.block.def.exec(e);if(o){let i=o[1].toLowerCase().replace(/\s+/g," "),r=o[2]?o[2].replace(/^<(.*)>$/,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=o[3]?o[3].substring(1,o[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):o[3];return{type:"def",tag:i,raw:o[0],href:r,title:s}}}table(e){let o=this.rules.block.table.exec(e);if(!o||!/[:|]/.test(o[2]))return;let i=Nl(o[1]),r=o[2].replace(/^\||\| *$/g,"").split("|"),s=o[3]&&o[3].trim()?o[3].replace(/\n[ \t]*$/,"").split(`
`):[],n={type:"table",raw:o[0],header:[],align:[],rows:[]};if(i.length===r.length){for(let c of r)/^ *-+: *$/.test(c)?n.align.push("right"):/^ *:-+: *$/.test(c)?n.align.push("center"):/^ *:-+ *$/.test(c)?n.align.push("left"):n.align.push(null);for(let c of i)n.header.push({text:c,tokens:this.lexer.inline(c)});for(let c of s)n.rows.push(Nl(c,n.header.length).map(h=>({text:h,tokens:this.lexer.inline(h)})));return n}}lheading(e){let o=this.rules.block.lheading.exec(e);if(o)return{type:"heading",raw:o[0],depth:o[2].charAt(0)==="="?1:2,text:o[1],tokens:this.lexer.inline(o[1])}}paragraph(e){let o=this.rules.block.paragraph.exec(e);if(o){let i=o[1].charAt(o[1].length-1)===`
`?o[1].slice(0,-1):o[1];return{type:"paragraph",raw:o[0],text:i,tokens:this.lexer.inline(i)}}}text(e){let o=this.rules.block.text.exec(e);if(o)return{type:"text",raw:o[0],text:o[0],tokens:this.lexer.inline(o[0])}}escape(e){let o=this.rules.inline.escape.exec(e);if(o)return{type:"escape",raw:o[0],text:he(o[1])}}tag(e){let o=this.rules.inline.tag.exec(e);if(o)return!this.lexer.state.inLink&&/^<a /i.test(o[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&/^<\/a>/i.test(o[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&/^<(pre|code|kbd|script)(\s|>)/i.test(o[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&/^<\/(pre|code|kbd|script)(\s|>)/i.test(o[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:o[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:o[0]}}link(e){let o=this.rules.inline.link.exec(e);if(o){let i=o[2].trim();if(!this.options.pedantic&&/^</.test(i)){if(!/>$/.test(i))return;let n=Lr(i.slice(0,-1),"\\");if((i.length-n.length)%2===0)return}else{let n=Eu(o[2],"()");if(n>-1){let h=(o[0].indexOf("!")===0?5:4)+o[1].length+n;o[2]=o[2].substring(0,n),o[0]=o[0].substring(0,h).trim(),o[3]=""}}let r=o[2],s="";if(this.options.pedantic){let n=/^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(r);n&&(r=n[1],s=n[3])}else s=o[3]?o[3].slice(1,-1):"";return r=r.trim(),/^</.test(r)&&(this.options.pedantic&&!/>$/.test(i)?r=r.slice(1):r=r.slice(1,-1)),Hl(o,{href:r&&r.replace(this.rules.inline.anyPunctuation,"$1"),title:s&&s.replace(this.rules.inline.anyPunctuation,"$1")},o[0],this.lexer)}}reflink(e,o){let i;if((i=this.rules.inline.reflink.exec(e))||(i=this.rules.inline.nolink.exec(e))){let r=(i[2]||i[1]).replace(/\s+/g," "),s=o[r.toLowerCase()];if(!s){let n=i[0].charAt(0);return{type:"text",raw:n,text:n}}return Hl(i,s,i[0],this.lexer)}}emStrong(e,o,i=""){let r=this.rules.inline.emStrongLDelim.exec(e);if(!r||r[3]&&i.match(/[\p{L}\p{N}]/u))return;if(!(r[1]||r[2]||"")||!i||this.rules.inline.punctuation.exec(i)){let n=[...r[0]].length-1,c,h,d=n,u=0,b=r[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(b.lastIndex=0,o=o.slice(-1*e.length+n);(r=b.exec(o))!=null;){if(c=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!c)continue;if(h=[...c].length,r[3]||r[4]){d+=h;continue}else if((r[5]||r[6])&&n%3&&!((n+h)%3)){u+=h;continue}if(d-=h,d>0)continue;h=Math.min(h,h+d+u);let f=[...r[0]][0].length,g=e.slice(0,n+r.index+f+h);if(Math.min(n,h)%2){let m=g.slice(1,-1);return{type:"em",raw:g,text:m,tokens:this.lexer.inlineTokens(m)}}let v=g.slice(2,-2);return{type:"strong",raw:g,text:v,tokens:this.lexer.inlineTokens(v)}}}}codespan(e){let o=this.rules.inline.code.exec(e);if(o){let i=o[2].replace(/\n/g," "),r=/[^ ]/.test(i),s=/^ /.test(i)&&/ $/.test(i);return r&&s&&(i=i.substring(1,i.length-1)),i=he(i,!0),{type:"codespan",raw:o[0],text:i}}}br(e){let o=this.rules.inline.br.exec(e);if(o)return{type:"br",raw:o[0]}}del(e){let o=this.rules.inline.del.exec(e);if(o)return{type:"del",raw:o[0],text:o[2],tokens:this.lexer.inlineTokens(o[2])}}autolink(e){let o=this.rules.inline.autolink.exec(e);if(o){let i,r;return o[2]==="@"?(i=he(o[1]),r="mailto:"+i):(i=he(o[1]),r=i),{type:"link",raw:o[0],text:i,href:r,tokens:[{type:"text",raw:i,text:i}]}}}url(e){let o;if(o=this.rules.inline.url.exec(e)){let i,r;if(o[2]==="@")i=he(o[0]),r="mailto:"+i;else{let s;do s=o[0],o[0]=this.rules.inline._backpedal.exec(o[0])?.[0]??"";while(s!==o[0]);i=he(o[0]),o[1]==="www."?r="http://"+o[0]:r=o[0]}return{type:"link",raw:o[0],text:i,href:r,tokens:[{type:"text",raw:i,text:i}]}}}inlineText(e){let o=this.rules.inline.text.exec(e);if(o){let i;return this.lexer.state.inRawBlock?i=o[0]:i=he(o[0]),{type:"text",raw:o[0],text:i}}}},$u=/^(?: *(?:\n|$))+/,Au=/^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/,_u=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,Ti=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Tu=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Yl=/(?:[*+-]|\d{1,9}[.)])/,Gl=mt(/^(?!bull )((?:.|\n(?!\s*?\n|bull ))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g,Yl).getRegex(),Va=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,Mu=/^[^\n]+/,qa=/(?!\s*\])(?:\\.|[^\[\]\\])+/,Iu=mt(/^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/).replace("label",qa).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Du=mt(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,Yl).getRegex(),_r="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Wa=/<!--(?!-?>)[\s\S]*?(?:-->|$)/,Ru=mt("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$))","i").replace("comment",Wa).replace("tag",_r).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Zl=mt(Va).replace("hr",Ti).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",_r).getRegex(),Pu=mt(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Zl).getRegex(),Na={blockquote:Pu,code:Au,def:Iu,fences:_u,heading:Tu,hr:Ti,html:Ru,lheading:Gl,list:Du,newline:$u,paragraph:Zl,table:$i,text:Mu},Ul=mt("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",Ti).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code"," {4}[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",_r).getRegex(),Ou={...Na,table:Ul,paragraph:mt(Va).replace("hr",Ti).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",Ul).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",_r).getRegex()},Bu={...Na,html:mt(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Wa).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:$i,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:mt(Va).replace("hr",Ti).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Gl).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Ql=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Fu=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Jl=/^( {2,}|\\)\n(?!\s*$)/,Vu=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Mi="\\p{P}$+<=>`^|~",qu=mt(/^((?![*_])[\spunctuation])/,"u").replace(/punctuation/g,Mi).getRegex(),Wu=/\[[^[\]]*?\]\([^\(\)]*?\)|`[^`]*?`|<[^<>]*?>/g,Nu=mt(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/,"u").replace(/punct/g,Mi).getRegex(),Hu=mt("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])","gu").replace(/punct/g,Mi).getRegex(),Uu=mt("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])","gu").replace(/punct/g,Mi).getRegex(),ju=mt(/\\([punct])/,"gu").replace(/punct/g,Mi).getRegex(),Ku=mt(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Xu=mt(Wa).replace("(?:-->|$)","-->").getRegex(),Yu=mt("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Xu).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Ar=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,Gu=mt(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label",Ar).replace("href",/<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),tc=mt(/^!?\[(label)\]\[(ref)\]/).replace("label",Ar).replace("ref",qa).getRegex(),ec=mt(/^!?\[(ref)\](?:\[\])?/).replace("ref",qa).getRegex(),Zu=mt("reflink|nolink(?!\\()","g").replace("reflink",tc).replace("nolink",ec).getRegex(),Ha={_backpedal:$i,anyPunctuation:ju,autolink:Ku,blockSkip:Wu,br:Jl,code:Fu,del:$i,emStrongLDelim:Nu,emStrongRDelimAst:Hu,emStrongRDelimUnd:Uu,escape:Ql,link:Gu,nolink:ec,punctuation:qu,reflink:tc,reflinkSearch:Zu,tag:Yu,text:Vu,url:$i},Qu={...Ha,link:mt(/^!?\[(label)\]\((.*?)\)/).replace("label",Ar).getRegex(),reflink:mt(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Ar).getRegex()},Ba={...Ha,escape:mt(Ql).replace("])","~|])").getRegex(),url:mt(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},Ju={...Ba,br:mt(Jl).replace("{2,}","*").getRegex(),text:mt(Ba.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},$r={normal:Na,gfm:Ou,pedantic:Bu},Li={normal:Ha,gfm:Ba,breaks:Ju,pedantic:Qu},Qe=class t{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Vo,this.options.tokenizer=this.options.tokenizer||new ei,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let o={block:$r.normal,inline:Li.normal};this.options.pedantic?(o.block=$r.pedantic,o.inline=Li.pedantic):this.options.gfm&&(o.block=$r.gfm,this.options.breaks?o.inline=Li.breaks:o.inline=Li.gfm),this.tokenizer.rules=o}static get rules(){return{block:$r,inline:Li}}static lex(e,o){return new t(o).lex(e)}static lexInline(e,o){return new t(o).inlineTokens(e)}lex(e){e=e.replace(/\r\n|\r/g,`
`),this.blockTokens(e,this.tokens);for(let o=0;o<this.inlineQueue.length;o++){let i=this.inlineQueue[o];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,o=[]){this.options.pedantic?e=e.replace(/\t/g,"    ").replace(/^ +$/gm,""):e=e.replace(/^( *)(\t+)/gm,(c,h,d)=>h+"    ".repeat(d.length));let i,r,s,n;for(;e;)if(!(this.options.extensions&&this.options.extensions.block&&this.options.extensions.block.some(c=>(i=c.call({lexer:this},e,o))?(e=e.substring(i.raw.length),o.push(i),!0):!1))){if(i=this.tokenizer.space(e)){e=e.substring(i.raw.length),i.raw.length===1&&o.length>0?o[o.length-1].raw+=`
`:o.push(i);continue}if(i=this.tokenizer.code(e)){e=e.substring(i.raw.length),r=o[o.length-1],r&&(r.type==="paragraph"||r.type==="text")?(r.raw+=`
`+i.raw,r.text+=`
`+i.text,this.inlineQueue[this.inlineQueue.length-1].src=r.text):o.push(i);continue}if(i=this.tokenizer.fences(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.heading(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.hr(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.blockquote(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.list(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.html(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.def(e)){e=e.substring(i.raw.length),r=o[o.length-1],r&&(r.type==="paragraph"||r.type==="text")?(r.raw+=`
`+i.raw,r.text+=`
`+i.raw,this.inlineQueue[this.inlineQueue.length-1].src=r.text):this.tokens.links[i.tag]||(this.tokens.links[i.tag]={href:i.href,title:i.title});continue}if(i=this.tokenizer.table(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.lheading(e)){e=e.substring(i.raw.length),o.push(i);continue}if(s=e,this.options.extensions&&this.options.extensions.startBlock){let c=1/0,h=e.slice(1),d;this.options.extensions.startBlock.forEach(u=>{d=u.call({lexer:this},h),typeof d=="number"&&d>=0&&(c=Math.min(c,d))}),c<1/0&&c>=0&&(s=e.substring(0,c+1))}if(this.state.top&&(i=this.tokenizer.paragraph(s))){r=o[o.length-1],n&&r.type==="paragraph"?(r.raw+=`
`+i.raw,r.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=r.text):o.push(i),n=s.length!==e.length,e=e.substring(i.raw.length);continue}if(i=this.tokenizer.text(e)){e=e.substring(i.raw.length),r=o[o.length-1],r&&r.type==="text"?(r.raw+=`
`+i.raw,r.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=r.text):o.push(i);continue}if(e){let c="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(c);break}else throw new Error(c)}}return this.state.top=!0,o}inline(e,o=[]){return this.inlineQueue.push({src:e,tokens:o}),o}inlineTokens(e,o=[]){let i,r,s,n=e,c,h,d;if(this.tokens.links){let u=Object.keys(this.tokens.links);if(u.length>0)for(;(c=this.tokenizer.rules.inline.reflinkSearch.exec(n))!=null;)u.includes(c[0].slice(c[0].lastIndexOf("[")+1,-1))&&(n=n.slice(0,c.index)+"["+"a".repeat(c[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(c=this.tokenizer.rules.inline.blockSkip.exec(n))!=null;)n=n.slice(0,c.index)+"["+"a".repeat(c[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;(c=this.tokenizer.rules.inline.anyPunctuation.exec(n))!=null;)n=n.slice(0,c.index)+"++"+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;e;)if(h||(d=""),h=!1,!(this.options.extensions&&this.options.extensions.inline&&this.options.extensions.inline.some(u=>(i=u.call({lexer:this},e,o))?(e=e.substring(i.raw.length),o.push(i),!0):!1))){if(i=this.tokenizer.escape(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.tag(e)){e=e.substring(i.raw.length),r=o[o.length-1],r&&i.type==="text"&&r.type==="text"?(r.raw+=i.raw,r.text+=i.text):o.push(i);continue}if(i=this.tokenizer.link(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(i.raw.length),r=o[o.length-1],r&&i.type==="text"&&r.type==="text"?(r.raw+=i.raw,r.text+=i.text):o.push(i);continue}if(i=this.tokenizer.emStrong(e,n,d)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.codespan(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.br(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.del(e)){e=e.substring(i.raw.length),o.push(i);continue}if(i=this.tokenizer.autolink(e)){e=e.substring(i.raw.length),o.push(i);continue}if(!this.state.inLink&&(i=this.tokenizer.url(e))){e=e.substring(i.raw.length),o.push(i);continue}if(s=e,this.options.extensions&&this.options.extensions.startInline){let u=1/0,b=e.slice(1),f;this.options.extensions.startInline.forEach(g=>{f=g.call({lexer:this},b),typeof f=="number"&&f>=0&&(u=Math.min(u,f))}),u<1/0&&u>=0&&(s=e.substring(0,u+1))}if(i=this.tokenizer.inlineText(s)){e=e.substring(i.raw.length),i.raw.slice(-1)!=="_"&&(d=i.raw.slice(-1)),h=!0,r=o[o.length-1],r&&r.type==="text"?(r.raw+=i.raw,r.text+=i.text):o.push(i);continue}if(e){let u="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(u);break}else throw new Error(u)}}return o}},oi=class{options;constructor(e){this.options=e||Vo}code(e,o,i){let r=(o||"").match(/^\S*/)?.[0];return e=e.replace(/\n$/,"")+`
`,r?'<pre><code class="language-'+he(r)+'">'+(i?e:he(e,!0))+`</code></pre>
`:"<pre><code>"+(i?e:he(e,!0))+`</code></pre>
`}blockquote(e){return`<blockquote>
${e}</blockquote>
`}html(e,o){return e}heading(e,o,i){return`<h${o}>${e}</h${o}>
`}hr(){return`<hr>
`}list(e,o,i){let r=o?"ol":"ul",s=o&&i!==1?' start="'+i+'"':"";return"<"+r+s+`>
`+e+"</"+r+`>
`}listitem(e,o,i){return`<li>${e}</li>
`}checkbox(e){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph(e){return`<p>${e}</p>
`}table(e,o){return o&&(o=`<tbody>${o}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+o+`</table>
`}tablerow(e){return`<tr>
${e}</tr>
`}tablecell(e,o){let i=o.header?"th":"td";return(o.align?`<${i} align="${o.align}">`:`<${i}>`)+e+`</${i}>
`}strong(e){return`<strong>${e}</strong>`}em(e){return`<em>${e}</em>`}codespan(e){return`<code>${e}</code>`}br(){return"<br>"}del(e){return`<del>${e}</del>`}link(e,o,i){let r=Wl(e);if(r===null)return i;e=r;let s='<a href="'+e+'"';return o&&(s+=' title="'+o+'"'),s+=">"+i+"</a>",s}image(e,o,i){let r=Wl(e);if(r===null)return i;e=r;let s=`<img src="${e}" alt="${i}"`;return o&&(s+=` title="${o}"`),s+=">",s}text(e){return e}},Ai=class{strong(e){return e}em(e){return e}codespan(e){return e}del(e){return e}html(e){return e}text(e){return e}link(e,o,i){return""+i}image(e,o,i){return""+i}br(){return""}},Je=class t{options;renderer;textRenderer;constructor(e){this.options=e||Vo,this.options.renderer=this.options.renderer||new oi,this.renderer=this.options.renderer,this.renderer.options=this.options,this.textRenderer=new Ai}static parse(e,o){return new t(o).parse(e)}static parseInline(e,o){return new t(o).parseInline(e)}parse(e,o=!0){let i="";for(let r=0;r<e.length;r++){let s=e[r];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[s.type]){let n=s,c=this.options.extensions.renderers[n.type].call({parser:this},n);if(c!==!1||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(n.type)){i+=c||"";continue}}switch(s.type){case"space":continue;case"hr":{i+=this.renderer.hr();continue}case"heading":{let n=s;i+=this.renderer.heading(this.parseInline(n.tokens),n.depth,Su(this.parseInline(n.tokens,this.textRenderer)));continue}case"code":{let n=s;i+=this.renderer.code(n.text,n.lang,!!n.escaped);continue}case"table":{let n=s,c="",h="";for(let u=0;u<n.header.length;u++)h+=this.renderer.tablecell(this.parseInline(n.header[u].tokens),{header:!0,align:n.align[u]});c+=this.renderer.tablerow(h);let d="";for(let u=0;u<n.rows.length;u++){let b=n.rows[u];h="";for(let f=0;f<b.length;f++)h+=this.renderer.tablecell(this.parseInline(b[f].tokens),{header:!1,align:n.align[f]});d+=this.renderer.tablerow(h)}i+=this.renderer.table(c,d);continue}case"blockquote":{let n=s,c=this.parse(n.tokens);i+=this.renderer.blockquote(c);continue}case"list":{let n=s,c=n.ordered,h=n.start,d=n.loose,u="";for(let b=0;b<n.items.length;b++){let f=n.items[b],g=f.checked,v=f.task,m="";if(f.task){let z=this.renderer.checkbox(!!g);d?f.tokens.length>0&&f.tokens[0].type==="paragraph"?(f.tokens[0].text=z+" "+f.tokens[0].text,f.tokens[0].tokens&&f.tokens[0].tokens.length>0&&f.tokens[0].tokens[0].type==="text"&&(f.tokens[0].tokens[0].text=z+" "+f.tokens[0].tokens[0].text)):f.tokens.unshift({type:"text",text:z+" "}):m+=z+" "}m+=this.parse(f.tokens,d),u+=this.renderer.listitem(m,v,!!g)}i+=this.renderer.list(u,c,h);continue}case"html":{let n=s;i+=this.renderer.html(n.text,n.block);continue}case"paragraph":{let n=s;i+=this.renderer.paragraph(this.parseInline(n.tokens));continue}case"text":{let n=s,c=n.tokens?this.parseInline(n.tokens):n.text;for(;r+1<e.length&&e[r+1].type==="text";)n=e[++r],c+=`
`+(n.tokens?this.parseInline(n.tokens):n.text);i+=o?this.renderer.paragraph(c):c;continue}default:{let n='Token with "'+s.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return i}parseInline(e,o){o=o||this.renderer;let i="";for(let r=0;r<e.length;r++){let s=e[r];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[s.type]){let n=this.options.extensions.renderers[s.type].call({parser:this},s);if(n!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(s.type)){i+=n||"";continue}}switch(s.type){case"escape":{let n=s;i+=o.text(n.text);break}case"html":{let n=s;i+=o.html(n.text);break}case"link":{let n=s;i+=o.link(n.href,n.title,this.parseInline(n.tokens,o));break}case"image":{let n=s;i+=o.image(n.href,n.title,n.text);break}case"strong":{let n=s;i+=o.strong(this.parseInline(n.tokens,o));break}case"em":{let n=s;i+=o.em(this.parseInline(n.tokens,o));break}case"codespan":{let n=s;i+=o.codespan(n.text);break}case"br":{i+=o.br();break}case"del":{let n=s;i+=o.del(this.parseInline(n.tokens,o));break}case"text":{let n=s;i+=o.text(n.text);break}default:{let n='Token with "'+s.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return i}},ti=class{options;constructor(e){this.options=e||Vo}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}},_i=class{defaults=Fa();options=this.setOptions;parse=this.#t(Qe.lex,Je.parse);parseInline=this.#t(Qe.lexInline,Je.parseInline);Parser=Je;Renderer=oi;TextRenderer=Ai;Lexer=Qe;Tokenizer=ei;Hooks=ti;constructor(...e){this.use(...e)}walkTokens(e,o){let i=[];for(let r of e)switch(i=i.concat(o.call(this,r)),r.type){case"table":{let s=r;for(let n of s.header)i=i.concat(this.walkTokens(n.tokens,o));for(let n of s.rows)for(let c of n)i=i.concat(this.walkTokens(c.tokens,o));break}case"list":{let s=r;i=i.concat(this.walkTokens(s.items,o));break}default:{let s=r;this.defaults.extensions?.childTokens?.[s.type]?this.defaults.extensions.childTokens[s.type].forEach(n=>{let c=s[n].flat(1/0);i=i.concat(this.walkTokens(c,o))}):s.tokens&&(i=i.concat(this.walkTokens(s.tokens,o)))}}return i}use(...e){let o=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(i=>{let r={...i};if(r.async=this.defaults.async||r.async||!1,i.extensions&&(i.extensions.forEach(s=>{if(!s.name)throw new Error("extension name required");if("renderer"in s){let n=o.renderers[s.name];n?o.renderers[s.name]=function(...c){let h=s.renderer.apply(this,c);return h===!1&&(h=n.apply(this,c)),h}:o.renderers[s.name]=s.renderer}if("tokenizer"in s){if(!s.level||s.level!=="block"&&s.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let n=o[s.level];n?n.unshift(s.tokenizer):o[s.level]=[s.tokenizer],s.start&&(s.level==="block"?o.startBlock?o.startBlock.push(s.start):o.startBlock=[s.start]:s.level==="inline"&&(o.startInline?o.startInline.push(s.start):o.startInline=[s.start]))}"childTokens"in s&&s.childTokens&&(o.childTokens[s.name]=s.childTokens)}),r.extensions=o),i.renderer){let s=this.defaults.renderer||new oi(this.defaults);for(let n in i.renderer){if(!(n in s))throw new Error(`renderer '${n}' does not exist`);if(n==="options")continue;let c=n,h=i.renderer[c],d=s[c];s[c]=(...u)=>{let b=h.apply(s,u);return b===!1&&(b=d.apply(s,u)),b||""}}r.renderer=s}if(i.tokenizer){let s=this.defaults.tokenizer||new ei(this.defaults);for(let n in i.tokenizer){if(!(n in s))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;let c=n,h=i.tokenizer[c],d=s[c];s[c]=(...u)=>{let b=h.apply(s,u);return b===!1&&(b=d.apply(s,u)),b}}r.tokenizer=s}if(i.hooks){let s=this.defaults.hooks||new ti;for(let n in i.hooks){if(!(n in s))throw new Error(`hook '${n}' does not exist`);if(n==="options")continue;let c=n,h=i.hooks[c],d=s[c];ti.passThroughHooks.has(n)?s[c]=u=>{if(this.defaults.async)return Promise.resolve(h.call(s,u)).then(f=>d.call(s,f));let b=h.call(s,u);return d.call(s,b)}:s[c]=(...u)=>{let b=h.apply(s,u);return b===!1&&(b=d.apply(s,u)),b}}r.hooks=s}if(i.walkTokens){let s=this.defaults.walkTokens,n=i.walkTokens;r.walkTokens=function(c){let h=[];return h.push(n.call(this,c)),s&&(h=h.concat(s.call(this,c))),h}}this.defaults={...this.defaults,...r}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,o){return Qe.lex(e,o??this.defaults)}parser(e,o){return Je.parse(e,o??this.defaults)}#t(e,o){return(i,r)=>{let s={...r},n={...this.defaults,...s};this.defaults.async===!0&&s.async===!1&&(n.silent||console.warn("marked(): The async option was set to true by an extension. The async: false option sent to parse will be ignored."),n.async=!0);let c=this.#e(!!n.silent,!!n.async);if(typeof i>"u"||i===null)return c(new Error("marked(): input parameter is undefined or null"));if(typeof i!="string")return c(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(i)+", string expected"));if(n.hooks&&(n.hooks.options=n),n.async)return Promise.resolve(n.hooks?n.hooks.preprocess(i):i).then(h=>e(h,n)).then(h=>n.hooks?n.hooks.processAllTokens(h):h).then(h=>n.walkTokens?Promise.all(this.walkTokens(h,n.walkTokens)).then(()=>h):h).then(h=>o(h,n)).then(h=>n.hooks?n.hooks.postprocess(h):h).catch(c);try{n.hooks&&(i=n.hooks.preprocess(i));let h=e(i,n);n.hooks&&(h=n.hooks.processAllTokens(h)),n.walkTokens&&this.walkTokens(h,n.walkTokens);let d=o(h,n);return n.hooks&&(d=n.hooks.postprocess(d)),d}catch(h){return c(h)}}}#e(e,o){return i=>{if(i.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let r="<p>An error occurred:</p><pre>"+he(i.message+"",!0)+"</pre>";return o?Promise.resolve(r):r}if(o)return Promise.reject(i);throw i}}},Fo=new _i;function ut(t,e){return Fo.parse(t,e)}ut.options=ut.setOptions=function(t){return Fo.setOptions(t),ut.defaults=Fo.defaults,jl(ut.defaults),ut};ut.getDefaults=Fa;ut.defaults=Vo;ut.use=function(...t){return Fo.use(...t),ut.defaults=Fo.defaults,jl(ut.defaults),ut};ut.walkTokens=function(t,e){return Fo.walkTokens(t,e)};ut.parseInline=Fo.parseInline;ut.Parser=Je;ut.parser=Je.parse;ut.Renderer=oi;ut.TextRenderer=Ai;ut.Lexer=Qe;ut.lexer=Qe.lex;ut.Tokenizer=ei;ut.Hooks=ti;ut.parse=ut;var iI=ut.options,rI=ut.setOptions,aI=ut.use,sI=ut.walkTokens,nI=ut.parseInline;var lI=Je.parse,cI=Qe.lex;var Ua=new _i,ja=new Set,Ii=class extends E{constructor(){super(...arguments),this.renderGeneration=0,this.suppressSlotChange=!1,this.tabSize=4}static getMarked(){return Ua}static updateAll(){for(let t of ja)t.renderMarkdown()}get marked(){return Ua}connectedCallback(){super.connectedCallback(),ja.add(this)}disconnectedCallback(){ja.delete(this),super.disconnectedCallback()}dedent(t){let o=t.replace(/\r\n/g,`
`).split(`
`).map(h=>{let d="",u=0;for(let b=0;b<h.length;b++){let f=h[b];if(f==="	"){let g=this.tabSize-u%this.tabSize;d+=" ".repeat(g),u+=g}else if(f===" ")d+=" ",u++;else{d+=h.slice(b);break}}return d}),i=0;for(;i<o.length&&o[i].trim()==="";)i++;let r=o.length-1;for(;r>=i&&o[r].trim()==="";)r--;let s=o.slice(i,r+1);if(s.length===0)return"";let n=1/0;for(let h of s){if(h.trim()==="")continue;let d=h.match(/^( *)/),u=d?d[1].length:0;n=Math.min(n,u)}return n===1/0&&(n=0),s.map(h=>h.trim()===""?"":h.slice(n)).join(`
`)}getSourceScript(){return this.querySelector('script[type="text/markdown"]')}renderMarkdown(){let t=this.getSourceScript();if(!t){console.warn('No <script type="text/markdown"> found. Provide markdown content inside a <script type="text/markdown"> element.',this);return}let e=++this.renderGeneration,o=t.textContent??"",i=this.dedent(o),r;try{r=Ua.parse(i)}catch(n){console.error("Failed to parse markdown content.",n,this);return}let s=n=>{if(e!==this.renderGeneration)return;this.suppressSlotChange=!0;for(let h of[...this.childNodes])h!==t&&h.remove();let c=document.createRange().createContextualFragment(n);this.appendChild(c),queueMicrotask(()=>{this.suppressSlotChange=!1})};typeof r=="string"?s(r):r.then(s).catch(n=>{console.error("Failed to parse markdown content.",n,this)})}handleSlotChange(){this.suppressSlotChange||this.didSSR&&!this.hasUpdated||this.renderMarkdown()}render(){return p`<slot @slotchange=${this.handleSlotChange}></slot>`}};Ii.css=Vl;a([l({type:Number,attribute:"tab-size"})],Ii.prototype,"tabSize",2);Ii=a([k("wa-markdown")],Ii);var oc=class extends Event{constructor(t){super("wa-mutation",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var ic=C`
  :host {
    display: contents;
  }
`;var xe=class extends E{constructor(){super(...arguments),this.attrOldValue=!1,this.charData=!1,this.charDataOldValue=!1,this.childList=!1,this.disabled=!1,this.handleMutation=t=>{this.dispatchEvent(new oc({mutationList:t}))}}connectedCallback(){super.connectedCallback(),typeof MutationObserver<"u"&&(this.mutationObserver=new MutationObserver(this.handleMutation),this.disabled||this.startObserver())}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}startObserver(){let t=typeof this.attr=="string"&&this.attr.length>0,e=t&&this.attr!=="*"?this.attr.split(" "):void 0;try{this.mutationObserver.observe(this,{subtree:!0,childList:this.childList,attributes:t,attributeFilter:e,attributeOldValue:this.attrOldValue,characterData:this.charData,characterDataOldValue:this.charDataOldValue})}catch{}}stopObserver(){this.mutationObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}handleChange(){this.stopObserver(),this.startObserver()}render(){return p` <slot></slot> `}};xe.css=ic;a([l({reflect:!0})],xe.prototype,"attr",2);a([l({attribute:"attr-old-value",type:Boolean,reflect:!0})],xe.prototype,"attrOldValue",2);a([l({attribute:"char-data",type:Boolean,reflect:!0})],xe.prototype,"charData",2);a([l({attribute:"char-data-old-value",type:Boolean,reflect:!0})],xe.prototype,"charDataOldValue",2);a([l({attribute:"child-list",type:Boolean,reflect:!0})],xe.prototype,"childList",2);a([l({type:Boolean,reflect:!0})],xe.prototype,"disabled",2);a([y("disabled")],xe.prototype,"handleDisabledChange",1);a([y("attr",{waitUntilFirstUpdate:!0}),y("attr-old-value",{waitUntilFirstUpdate:!0}),y("char-data",{waitUntilFirstUpdate:!0}),y("char-data-old-value",{waitUntilFirstUpdate:!0}),y("childList",{waitUntilFirstUpdate:!0})],xe.prototype,"handleChange",1);xe=a([k("wa-mutation-observer")],xe);var rc=C`
  :host(:focus) {
    outline: none;
  }

  .number-field {
    display: flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    height: var(--wa-form-control-height);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    cursor: text;
    color: var(--wa-form-control-value-color);
    font-size: inherit;
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    vertical-align: middle;
    width: 100%;
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    background-color: var(--wa-form-control-background-color);
    padding: 0;
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);

    &:focus-within {
      outline-color: var(--wa-color-focus);
    }

    /* Style disabled inputs */
    &:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  /* Appearance modifiers */
  :host([appearance='outlined']) {
    .number-field {
      background-color: var(--wa-form-control-background-color);
      border-color: var(--wa-form-control-border-color);
    }

    .stepper {
      color: var(--wa-color-neutral-on-quiet);

      @media (hover: hover) {
        &:hover:not(:disabled) {
          color: var(--wa-color-neutral-on-quiet);
          background-color: var(--wa-color-neutral-fill-quiet);
        }
      }

      &:active:not(:disabled) {
        color: color-mix(in oklab, var(--wa-color-neutral-on-quiet), var(--wa-color-mix-active));
        background-color: color-mix(in oklab, var(--wa-color-neutral-fill-quiet), var(--wa-color-mix-active));
      }
    }
  }

  :host([appearance='filled']) {
    .number-field {
      background-color: var(--wa-color-neutral-fill-quiet);
      border-color: var(--wa-color-neutral-fill-quiet);
    }

    .stepper {
      color: var(--wa-color-neutral-on-quiet);

      @media (hover: hover) {
        &:hover:not(:disabled) {
          color: var(--wa-color-neutral-on-normal);
          background-color: var(--wa-color-neutral-fill-normal);
        }
      }

      &:active:not(:disabled) {
        color: color-mix(in oklab, var(--wa-color-neutral-on-normal), var(--wa-color-mix-active));
        background-color: color-mix(in oklab, var(--wa-color-neutral-fill-normal), var(--wa-color-mix-active));
      }
    }
  }

  :host([appearance='filled-outlined']) {
    .number-field {
      background-color: var(--wa-color-neutral-fill-quiet);
      border-color: var(--wa-form-control-border-color);
    }

    .stepper {
      color: var(--wa-color-neutral-on-quiet);

      @media (hover: hover) {
        &:hover:not(:disabled) {
          color: var(--wa-color-neutral-on-normal);
          background-color: var(--wa-color-neutral-fill-normal);
        }
      }

      &:active:not(:disabled) {
        color: color-mix(in oklab, var(--wa-color-neutral-on-normal), var(--wa-color-mix-active));
        background-color: color-mix(in oklab, var(--wa-color-neutral-fill-normal), var(--wa-color-mix-active));
      }
    }
  }

  :host([pill]) {
    .number-field,
    .stepper {
      border-radius: var(--wa-border-radius-pill);
    }
  }

  .number-field {
    /* Show autofill styles over the entire number field, not just the native <input> */
    &:has(:autofill),
    &:has(:-webkit-autofill) {
      background-color: var(--wa-color-brand-fill-quiet) !important;
    }

    input {
      flex: auto;
      height: 100%;
      width: auto;
      min-width: 0;
      margin: 0;
      padding: 0 var(--wa-form-control-padding-inline);
      outline: none;
      box-shadow: none;
      border: none;
      background-color: transparent;
      font: inherit;
      transition: inherit;
      cursor: inherit;
      -webkit-appearance: none;

      /* Center-align and use tabular numbers for better alignment */
      text-align: center;
      font-variant-numeric: tabular-nums;

      /* Hide the number spinners in Firefox */
      -moz-appearance: textfield;

      /* Hide the number spinners in Chrome/Safari */
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
        display: none;
      }

      /* Turn off Safari's autofill styles */
      &:-webkit-autofill,
      &:-webkit-autofill:hover,
      &:-webkit-autofill:focus,
      &:-webkit-autofill:active {
        -webkit-background-clip: text;
        background-color: transparent;
        -webkit-text-fill-color: inherit;
      }
    }

    &:autofill {
      &,
      &:hover,
      &:focus,
      &:active {
        box-shadow: none;
        caret-color: var(--wa-form-control-value-color);
      }
    }

    &::placeholder {
      color: var(--wa-form-control-placeholder-color);
      user-select: none;
      -webkit-user-select: none;
    }

    &:focus {
      outline: none;
    }
  }

  .start,
  .end {
    display: inline-flex;
    flex: 1;
    align-items: center;
    cursor: default;

    &::slotted(wa-icon) {
      color: var(--wa-color-neutral-on-quiet);
    }
  }

  .start {
    justify-content: start;
    margin-inline-start: var(--wa-form-control-padding-inline);
  }

  .end {
    justify-content: end;
    margin-inline-end: var(--wa-form-control-padding-inline);
  }

  /*
   * Steppers - horizontal layout with minus on start, plus on end
   */

  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    height: calc(100% - var(--wa-form-control-border-width) * 2);
    flex: 0 0 auto;
    border: none;
    border-radius: calc(var(--wa-form-control-border-radius) - var(--wa-form-control-border-width) * 2);
    background: transparent;
    cursor: pointer;
    margin: var(--wa-form-control-border-width);
    padding: 0;
    font-size: inherit;
    transition-property: background-color, color;
    transition-duration: var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:focus {
      outline: none;
    }
  }

  :host([without-steppers]) .stepper {
    display: none;
  }
`;var ht=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["blur","input"],this.hasSlotController=new Z(this,"hint","label"),this.localize=new I(this),this.title="",this._value=null,this.defaultValue=this.getAttribute("value")||null,this.size="m",this.appearance="outlined",this.pill=!1,this.label="",this.hint="",this.placeholder="",this.readonly=!1,this.required=!1,this.step=1,this.withoutSteppers=!1,this.inputmode="numeric",this.withLabel=!1,this.withHint=!1}static get validators(){return[...super.validators,jt()]}get value(){return this.valueHasChanged?this._value:this._value??this.defaultValue}set value(t){this._value!==t&&(this.valueHasChanged=!0,this._value=t)}handleSizeChange(){U(this.localName,this.size)}updateFormValue(t){if(t==null){this.setValue("",null);return}super.updateFormValue(t)}get isAtMin(){if(this.min===void 0)return!1;let t=parseFloat(this.value||"");return!isNaN(t)&&t<=this.min}get isAtMax(){if(this.max===void 0)return!1;let t=parseFloat(this.value||"");return!isNaN(t)&&t>=this.max}handleChange(t){this.value=this.input.value,this.relayNativeEvent(t,{bubbles:!0,composed:!0})}handleInput(){this.value=this.input.value}handleKeyDown(t){ho(t,this),(t.key==="ArrowUp"||t.key==="ArrowDown")&&requestAnimationFrame(()=>{this.value!==this.input.value&&(this.value=this.input.value)})}handleStepperPointerUp(t,e){if(this.disabled||this.readonly)return;let o=new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,composed:!0});this.dispatchEvent(o),!o.defaultPrevented&&(t==="up"?this.input.stepUp():this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),e.pointerType!=="touch"&&this.input.focus())}handleStepperPointerDown(t){t.pointerType!=="touch"&&(t.preventDefault(),this.input.focus())}updated(t){super.updated(t),(t.has("value")||t.has("defaultValue"))&&(this.input&&this.value&&this.input.value!==this.value&&(this._value=this.input.value),this.customStates.set("blank",!this.value))}handleStepChange(){this.input.step=String(this.step),this.updateValidity()}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}formResetCallback(){this.value=this.defaultValue,super.formResetCallback()}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e;return p`
      <label
        part="form-control-label label"
        class=${_({label:!0,"has-label":o})}
        for="input"
        aria-hidden=${o?"false":"true"}
      >
        <slot name="label">${this.label}</slot>
      </label>

      <div part="base number-input" class="number-field">
        ${this.withoutSteppers?"":p`
              <button
                part="stepper stepper-decrement"
                class="stepper stepper-decrement"
                type="button"
                tabindex="-1"
                aria-label=${this.localize.term("decrement")}
                ?disabled=${this.disabled||this.readonly||this.isAtMin}
                @pointerdown=${this.handleStepperPointerDown}
                @pointerup=${r=>this.handleStepperPointerUp("down",r)}
              >
                <slot name="decrement-icon">
                  <wa-icon name="minus" library="system"></wa-icon>
                </slot>
              </button>
            `}

        <slot name="start" part="start" class="start"></slot>

        <input
          part="input"
          id="input"
          class="control"
          type="number"
          inputmode=${M(this.inputmode)}
          title=${this.title}
          name=${M(this.name)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          placeholder=${M(this.placeholder)}
          min=${M(this.min)}
          max=${M(this.max)}
          step=${M(this.step)}
          .value=${Mt(this.value??"")}
          autocomplete=${M(this.autocomplete)}
          ?autofocus=${this.autofocus}
          enterkeyhint=${M(this.enterkeyhint)}
          aria-describedby="hint"
          @change=${this.handleChange}
          @input=${this.handleInput}
          @keydown=${this.handleKeyDown}
        />

        <slot name="end" part="end" class="end"></slot>

        ${this.withoutSteppers?"":p`
              <button
                part="stepper stepper-increment"
                class="stepper stepper-increment"
                type="button"
                tabindex="-1"
                aria-label=${this.localize.term("increment")}
                ?disabled=${this.disabled||this.readonly||this.isAtMax}
                @pointerdown=${this.handleStepperPointerDown}
                @pointerup=${r=>this.handleStepperPointerUp("up",r)}
              >
                <slot name="increment-icon">
                  <wa-icon name="plus" library="system"></wa-icon>
                </slot>
              </button>
            `}
      </div>

      <slot
        id="hint"
        part="hint"
        name="hint"
        class=${_({"has-slotted":i})}
        aria-hidden=${i?"false":"true"}
        >${this.hint}</slot
      >
    `}};ht.css=[j,pt,rc];ht.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S("input")],ht.prototype,"input",2);a([l()],ht.prototype,"title",2);a([A()],ht.prototype,"value",1);a([l({attribute:"value",reflect:!0})],ht.prototype,"defaultValue",2);a([l({reflect:!0})],ht.prototype,"size",2);a([y("size")],ht.prototype,"handleSizeChange",1);a([l({reflect:!0})],ht.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],ht.prototype,"pill",2);a([l()],ht.prototype,"label",2);a([l({attribute:"hint"})],ht.prototype,"hint",2);a([l()],ht.prototype,"placeholder",2);a([l({type:Boolean,reflect:!0})],ht.prototype,"readonly",2);a([l({type:Boolean,reflect:!0})],ht.prototype,"required",2);a([l({type:Number})],ht.prototype,"min",2);a([l({type:Number})],ht.prototype,"max",2);a([l()],ht.prototype,"step",2);a([l({attribute:"without-steppers",type:Boolean})],ht.prototype,"withoutSteppers",2);a([l()],ht.prototype,"autocomplete",2);a([l({type:Boolean})],ht.prototype,"autofocus",2);a([l()],ht.prototype,"enterkeyhint",2);a([l()],ht.prototype,"inputmode",2);a([l({attribute:"with-label",type:Boolean})],ht.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],ht.prototype,"withHint",2);a([y("step",{waitUntilFirstUpdate:!0})],ht.prototype,"handleStepChange",1);ht=a([k("wa-number-input")],ht);ht.disableWarning?.("change-in-update");var ac=C`
  :host {
    --current-text-color: var(--wa-color-brand-on-loud);

    display: block;
    color: var(--wa-color-text-normal);
    -webkit-user-select: none;
    user-select: none;

    position: relative;
    display: flex;
    align-items: center;
    font: inherit;
    padding: 0.5em 1em 0.5em 0.25em;
    border-radius: var(--wa-border-radius-s);
    line-height: var(--wa-line-height-condensed);
    transition: var(--wa-transition-fast) background-color var(--wa-transition-easing);
    cursor: pointer;
  }

  :host(:focus) {
    outline: none;
  }

  @media (hover: hover) {
    :host(:not(:state(disabled), :state(current)):is(:state(hover), :hover)) {
      background-color: var(--wa-color-neutral-fill-normal);
      color: var(--wa-color-neutral-on-normal);
    }
  }

  :host(:state(current)),
  :host(:state(disabled):state(current)) {
    background-color: var(--wa-form-control-activated-color);
    color: var(--current-text-color);
    opacity: 1;
  }

  :host(:state(disabled)) {
    outline: none;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .label {
    flex: 1 1 auto;
    display: inline-block;
  }

  .check {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--wa-font-size-smaller);
    visibility: hidden;
    width: 2em;
  }

  :host(:state(selected)) .check {
    visibility: visible;
  }

  .start,
  .end {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .start::slotted(*) {
    margin-inline-end: 0.5em;
  }

  .end::slotted(*) {
    margin-inline-start: 0.5em;
  }

  @media (forced-colors: active) {
    :host(:hover:not([aria-disabled='true'])) {
      outline: dashed 1px SelectedItem;
      outline-offset: -1px;
    }
  }
`;function Di(t,e=0){if(!t||!globalThis.Node)return"";if(typeof t[Symbol.iterator]=="function")return(Array.isArray(t)?t:[...t]).map(r=>Di(r,--e)).join("");let o=t;if(o.nodeType===Node.TEXT_NODE)return o.textContent??"";if(o.nodeType===Node.ELEMENT_NODE){let i=o;if(i.hasAttribute("slot")||i.matches("style, script"))return"";if(i instanceof HTMLSlotElement){let r=i.assignedNodes({flatten:!0});if(r.length>0)return Di(r,--e)}return e>-1?Di(i,--e):i.textContent??""}return o.hasChildNodes()?Di(o.childNodes,--e):""}var Ae=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.cachedDefaultLabel="",this.isInitialized=!1,this.isDefaultLabelDirty=!0,this.current=!1,this.value="",this.disabled=!1,this.selected=!1,this.defaultSelected=!1,this._label="",this.handleHover=t=>{t.type==="mouseenter"?this.customStates.set("hover",!0):t.type==="mouseleave"&&this.customStates.set("hover",!1)}}set label(t){let e=this._label;this._label=t||"",this._label!==e&&this.requestUpdate("label",e)}get label(){return this._label?this._label:this.defaultLabel}get defaultLabel(){return(this.isDefaultLabelDirty||!this.cachedDefaultLabel)&&this.updateDefaultLabel(),this.cachedDefaultLabel}connectedCallback(){super.connectedCallback(),this.setAttribute("role","option"),this.setAttribute("aria-selected","false"),this.addEventListener("mouseenter",this.handleHover),this.addEventListener("mouseleave",this.handleHover)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("mouseenter",this.handleHover),this.removeEventListener("mouseleave",this.handleHover)}handleDefaultSlotChange(){this.isDefaultLabelDirty=!0,this.isInitialized?(customElements.whenDefined("wa-select").then(()=>{let t=this.closest("wa-select");t&&t.handleDefaultSlotChange?.()}),customElements.whenDefined("wa-combobox").then(()=>{let t=this.closest("wa-combobox");t&&t.handleDefaultSlotChange?.()})):this.isInitialized=!0}willUpdate(t){t.has("defaultSelected")&&(this.didSSR&&this.hasUpdated||!this.didSSR)&&this.syncDefaultSelected(),super.willUpdate(t)}syncDefaultSelected(){if("closest"in this&&!this.closest("wa-combobox, wa-select")?.hasInteracted&&this.defaultSelected){let t=this.selected;this.selected=this.defaultSelected,this.requestUpdate("selected",t)}}updated(t){t.has("disabled")&&(this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.customStates.set("disabled",this.disabled)),t.has("selected")&&(this.setAttribute("aria-selected",this.selected?"true":"false"),this.customStates.set("selected",this.selected)),t.has("value")&&(typeof this.value!="string"&&(this.value=String(this.value)),this.handleDefaultSlotChange()),t.has("current")&&this.customStates.set("current",this.current),super.updated(t)}async firstUpdated(t){if(super.firstUpdated(t),this.didSSR&&!this.hasUpdated?(await this.updateComplete,this.syncDefaultSelected()):this.syncDefaultSelected(),this.selected&&!this.defaultSelected){let e=this.closest("wa-select, wa-combobox");e&&!e.hasInteracted&&(await customElements.whenDefined(e?.localName),await e.updateComplete,e.selectionChanged?.())}}updateDefaultLabel(){let t=this.cachedDefaultLabel;this.cachedDefaultLabel=Di(this).trim(),this.isDefaultLabelDirty=!1;let e=this.cachedDefaultLabel!==t;return!this._label&&e&&this.requestUpdate("label",t),e}render(){let t=this.selected;return this.didSSR&&!this.hasUpdated?(this.updateComplete.then(()=>{this.requestUpdate()}),lt):p`
      ${t?p`<wa-icon
            part="checked-icon"
            class="check"
            name="check"
            library="system"
            variant="solid"
            aria-hidden="true"
          ></wa-icon>`:p`<span part="checked-icon" class="check" aria-hidden="true"></span>`}
      <slot part="start" name="start" class="start"></slot>
      <slot part="label" class="label" @slotchange=${this.handleDefaultSlotChange}></slot>
      <slot part="end" name="end" class="end"></slot>
    `}};Ae.css=ac;a([S(".label")],Ae.prototype,"defaultSlot",2);a([A()],Ae.prototype,"current",2);a([l({reflect:!0})],Ae.prototype,"value",2);a([l({type:Boolean})],Ae.prototype,"disabled",2);a([l({type:Boolean,attribute:!1})],Ae.prototype,"selected",2);a([l({type:Boolean,attribute:"selected"})],Ae.prototype,"defaultSelected",2);a([l()],Ae.prototype,"label",1);Ae=a([k("wa-option")],Ae);var sc=class extends Event{constructor(){super("wa-complete",{bubbles:!0,cancelable:!0,composed:!0})}};var nc=C`
  :host(:focus) {
    outline: none;
  }

  /* Segments container */
  .segments {
    position: relative;
    /* Codes read left-to-right regardless of locale — keep segment order and caret movement LTR
       even when the surrounding page is RTL. */
    direction: ltr;
    display: inline-flex;
    align-items: center;
    align-self: start;
    gap: var(--segment-gap, var(--wa-space-xs));
    cursor: text;
    /* Never grow past the host's available width — long values or large segment sizes scroll
       horizontally instead of overflowing the page. */
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    /* Setting overflow-x forces overflow-y to also compute to non-visible, which would otherwise
       clip the focus ring's bleed around the active segment — above/below for any segment, and
       left/right for the first/last segment specifically. Reserve room for it with padding, then
       cancel the layout impact with an equal negative margin on both axes. */
    padding: calc(var(--wa-focus-ring-offset) + var(--wa-focus-ring-width));
    margin: calc(-1 * (var(--wa-focus-ring-offset) + var(--wa-focus-ring-width)));
  }

  .segments::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  :host(:state(disabled)) .segments {
    cursor: not-allowed;
    opacity: 0.5;
  }

  :host(:state(readonly)) .segments {
    cursor: default;
  }

  /* Focus ring on the active segment, and on every segment in a multi-character selection */
  .segments:focus-within .segment--active,
  .segments:focus-within .segment--selected {
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) var(--wa-color-focus);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Readonly has no per-segment active/selected state (see render()), so every segment rings
     at once to show the control as a whole has focus. */
  :host(:state(readonly)) .segments:focus-within .segment {
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) var(--wa-color-focus);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Contained segments sit flush with zero gap and have no border of their own, so a ring drawn
     outside the segment edge (the default, positive offset) bleeds into the neighboring segment.
     Draw it inward instead so it stays within this segment's own box. */
  :host([appearance='contained']) .segments:focus-within .segment--active,
  :host([appearance='contained']) .segments:focus-within .segment--selected,
  :host([appearance='contained']:state(readonly)) .segments:focus-within .segment {
    outline-offset: calc(-1 * var(--wa-focus-ring-width));
  }

  /* Hidden real input — off-screen but focusable.
     Chromium mishandles typing over a full selection (drops the inserted character) when a
     text input has zero layout size, so this stays a non-zero 1x1px box instead of 0x0. */
  .hidden-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    border: none;
    padding: 0;
    margin: 0;
  }

  /* Individual visual segment */
  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--segment-size, 2.5em);
    height: var(--segment-size, 2.5em);
    border-radius: var(--segment-border-radius, var(--wa-form-control-border-radius));
    font-size: 1em;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    position: relative;
    user-select: none;
    /* Zero-width outline present at all times so the focus ring can grow in smoothly
       instead of popping in the instant .segment--active/--selected starts matching. */
    outline: var(--wa-focus-ring-style) 0 var(--wa-color-focus);
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast),
      outline-width var(--wa-transition-fast),
      outline-offset var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
  }

  /* Blinking caret in the active segment */
  .caret {
    position: absolute;
    width: 1.5px;
    height: 60%;
    background-color: currentColor;
    animation: wa-otp-caret-blink 1s step-end infinite;
  }

  @keyframes wa-otp-caret-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* Literal separator character between segment groups */
  .segment-literal {
    display: inline-block;
    flex-shrink: 0;
    color: var(--wa-color-text-quiet);
    white-space: pre;
    user-select: none;
  }

  /* Appearance: outlined (default) */
  :host([appearance='outlined']) .segment,
  :host(:not([appearance])) .segment {
    background-color: var(--wa-form-control-background-color);
    border: var(--wa-form-control-border-width) var(--wa-form-control-border-style) var(--wa-form-control-border-color);
  }

  /* Appearance: filled */
  :host([appearance='filled']) .segment {
    background-color: var(--wa-color-neutral-fill-quiet);
    border: var(--wa-form-control-border-width) var(--wa-form-control-border-style) transparent;
  }

  /* Appearance: filled-outlined */
  :host([appearance='filled-outlined']) .segment {
    background-color: var(--wa-color-neutral-fill-quiet);
    border: var(--wa-form-control-border-width) var(--wa-form-control-border-style) var(--wa-form-control-border-color);
  }

  /* Appearance: contained */
  :host([appearance='contained']) .segments {
    gap: 0;
    border: var(--wa-form-control-border-width) var(--wa-form-control-border-style) var(--wa-form-control-border-color);
    border-radius: var(--segment-border-radius, var(--wa-form-control-border-radius));
    background-color: var(--wa-form-control-background-color);
    overflow: hidden;
    /* The focus ring is drawn inward here (see outline-offset above), so there's no outward bleed
       to reserve room for. .segments is also the visible bordered box in this appearance, so the
       padding/negative-margin bleed trick from the base rule would visibly shift and inflate it. */
    padding: 0;
    margin: 0;
  }

  :host([appearance='contained']) .segment {
    border: none;
    border-radius: 0;
  }

  /* Dividers between contained segments */
  :host([appearance='contained']) .segment + .segment,
  :host([appearance='contained']) .segment-literal + .segment {
    border-left: var(--wa-form-control-border-width) var(--wa-form-control-border-style)
      var(--wa-form-control-border-color);
  }

  /* ── Active segment (where next char will go), and every segment in a multi-character
     selection (e.g. from Cmd/Ctrl+A) — same border + focus-ring treatment for both.
     :host(...) wrapper matches the specificity of the appearance rules above so this
     border-color isn't silently lost to the cascade. ── */
  :host(:not(:state(readonly))) .segment--active,
  :host(:not(:state(readonly))) .segment--selected {
    border-color: var(--wa-color-focus);
  }

  /* Masked filled character, and the empty-segment hint shown when with-mask is set, both draw
     --mask-char via a pseudo-element instead of real text, so a masked value never touches the
     DOM as plain text (nothing to find via view-source or copy). */
  .segment--masked::before,
  .segment--mask-hint::before {
    content: var(--mask-char, '•');
  }

  .segment--mask-hint::before {
    opacity: 0.35;
  }
`;var ft=class extends q{constructor(){super(...arguments),this.hasSlotController=new Z(this,"label","hint"),this._focused=!1,this._activeIndex=-1,this._selectionAnchor=-1,this._pendingClickIndex=null,this._value="",this.defaultValue=this.getAttribute("value")??null,this.length=6,this.appearance="outlined",this.type="numeric",this.mask=!1,this.case="preserve",this.size="m",this.label="",this.hint="",this.format="",this.autocomplete="one-time-code",this.required=!1,this.readonly=!1,this.autosubmit=!1,this.autofocus=!1,this.withMask=!1,this.assumeInteractionOn=["blur","input"],this._lastChangeValue=""}static get validators(){return[...super.validators,jt()]}get validationTarget(){return this.segmentsContainer}get hasSelection(){return this._selectionAnchor>=0&&this._selectionAnchor!==this._activeIndex}setCaretIndex(t){this._activeIndex=t,this._selectionAnchor=-1}get value(){return this._value}set value(t){let e=this.filterAndTransform(t).slice(0,this.effectiveLength);if(this._value===e)return;let o=this._value;this._value=e,this.setValue(e),this.input&&(this.input.value=e),this._focused&&this.setCaretIndex(Math.min(e.length,this.effectiveLength-1)),this.requestUpdate("value",o)}handleSizeChange(){U(this.localName,this.size)}get effectiveLength(){return this.format?[...this.format].filter(t=>t==="#").length:this.length}get parsedFormat(){return[...this.format||"#".repeat(this.length)].map(e=>({type:e==="#"?"segment":"separator",char:e}))}filterAndTransform(t){let e=t;return this.type==="numeric"?e=e.replace(/\D/g,""):this.type==="alpha"?e=e.replace(/[^a-zA-Z]/g,""):this.type==="alphanumeric"&&(e=e.replace(/[^a-zA-Z0-9]/g,"")),this.case==="upper"?e=e.toUpperCase():this.case==="lower"&&(e=e.toLowerCase()),e}willUpdate(t){if(super.willUpdate(t),!this.hasUpdated){let e=this.filterAndTransform(this.defaultValue??"").slice(0,this.effectiveLength);this._value!==e&&(this._value=e,this.setValue(e),this._lastChangeValue=e)}if(this.hasUpdated&&(t.has("type")||t.has("case")||t.has("length")||t.has("format"))){let e=this.filterAndTransform(this._value).slice(0,this.effectiveLength);e!==this._value&&(this._value=e,this.setValue(e),this.input&&(this.input.value=e))}}updated(t){super.updated(t);let e=this._value;this.customStates.set("--blank",e.length===0),this.customStates.set("--filled",e.length===this.effectiveLength),this.customStates.set("readonly",this.readonly),(t.has("value")||t.has("required")||t.has("length")||t.has("format"))&&this.updateValidity(),this.syncCursor();let o=this.segmentsContainer?.querySelector(".segment--active, .segment--selected");o&&this.segmentsContainer&&go(o,this.segmentsContainer,"horizontal","auto")}syncCursor(){if(!this._focused||!this.input||this._activeIndex<0||this.hasSelection)return;let t=this._value.length,e=Math.min(this._activeIndex,t),o=this._activeIndex<t?e+1:e;this.input.setSelectionRange(e,o)}formResetCallback(){super.formResetCallback();let t=this.filterAndTransform(this.defaultValue??"").slice(0,this.effectiveLength),e=this._value;this._value=t,this.setValue(t),this._lastChangeValue=t,this.input&&(this.input.value=t),this.requestUpdate("value",e)}handleInput(t){if(this.readonly)return;let e=t.target,o=e.value,i=e.selectionStart??o.length,r=this.filterAndTransform(o).slice(0,this.effectiveLength),s=i;if(o!==r){e.value=r;let h=o.slice(0,i);s=Math.min(this.filterAndTransform(h).length,this.effectiveLength)}this.setCaretIndex(Math.min(s,this.effectiveLength-1));let n=this._value.length,c=this._value;this._value=r,this.setValue(r),this.maybeDispatchComplete(r.length===this.effectiveLength&&n<this.effectiveLength),this.requestUpdate("value",c)}maybeDispatchComplete(t){if(!t)return;let e=this.dispatchEvent(new sc);this.autosubmit&&e&&setTimeout(()=>xa(this))}handleKeyDown(t){if(t.isComposing)return;let e=this.effectiveLength;if(t.key==="Enter")ho(t,this);else if(this.readonly)(t.key==="Backspace"||t.key==="Delete")&&t.preventDefault();else if(t.key==="ArrowRight")t.preventDefault(),this.hasSelection?this.setCaretIndex(Math.min(Math.max(this._selectionAnchor,this._activeIndex),e-1)):this._activeIndex=Math.min(this._activeIndex+1,e-1);else if(t.key==="ArrowLeft")t.preventDefault(),this.hasSelection?this.setCaretIndex(Math.max(Math.min(this._selectionAnchor,this._activeIndex),0)):this._activeIndex=Math.max(this._activeIndex-1,0);else if(t.key==="Backspace")if(t.preventDefault(),this.hasSelection){let o=Math.min(this._selectionAnchor,this._activeIndex),i=Math.max(this._selectionAnchor,this._activeIndex);this.spliceValue(o,i),this.setCaretIndex(Math.min(o,e-1))}else{let o=this._activeIndex;o<this._value.length&&this.spliceValue(o),this.setCaretIndex(Math.max(o-1,0))}else if(t.key==="Delete")if(t.preventDefault(),this.hasSelection){let o=Math.min(this._selectionAnchor,this._activeIndex),i=Math.max(this._selectionAnchor,this._activeIndex);this.spliceValue(o,i),this.setCaretIndex(Math.min(o,e-1))}else{let o=this._activeIndex;o<this._value.length&&this.spliceValue(o)}}spliceValue(t,e=t+1){let o=this._value.slice(0,t)+this._value.slice(e),i=this._value;this._value=o,this.setValue(o),this.input&&(this.input.value=o),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.requestUpdate("value",i)}handlePaste(t){if(t.preventDefault(),this.readonly)return;let e=t.clipboardData?.getData("text/plain")??"",o=this.filterAndTransform(e);if(!o)return;let i=this._activeIndex,r=this.effectiveLength,s=Array.from({length:r},(u,b)=>this._value[b]??"");for(let u=0;u<o.length&&i+u<r;u++)s[i+u]=o[u];let n=r-1;for(;n>=0&&!s[n];)n--;let c=n>=0?s.slice(0,n+1).join(""):"",h=this._value.length,d=this._value;this._value=c,this.setValue(c),this.input&&(this.input.value=c),this.setCaretIndex(Math.min(i+o.length,r-1)),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.maybeDispatchComplete(c.length===r&&h<r),this.requestUpdate("value",d)}handleFocus(){this._focused=!0,this.setCaretIndex(this._pendingClickIndex??Math.min(this._value.length,this.effectiveLength-1))}handleSelect(){if(!this.input)return;let t=this.input.selectionStart??0,e=this.input.selectionEnd??t;e-t>1?(this._selectionAnchor=t,this._activeIndex=e):this._selectionAnchor!==-1&&(this._selectionAnchor=-1)}handleBlur(){this._focused=!1,this.setCaretIndex(-1),this._value!==this._lastChangeValue&&(this._lastChangeValue=this._value,this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})))}segmentIndexAt(t){let e=t.closest('[part~="segment"]');if(!e||!this.shadowRoot)return null;let i=[...this.shadowRoot.querySelectorAll('[part~="segment"]')].indexOf(e);return i>=0?Math.min(i,this._value.length):null}handleSegmentsPointerDown(t){this.disabled||(this._pendingClickIndex=this.segmentIndexAt(t.target))}handleSegmentsClick(t){if(this.disabled)return;this.input?.focus();let e=this.segmentIndexAt(t.target);e!==null&&this.setCaretIndex(e),this._pendingClickIndex=null}clear(){this.value="",this.dispatchEvent(new co),this.focus()}focus(t){this.input?.focus(t)}blur(){this.input?.blur()}select(){this.input?.select()}render(){let t=this.hasSlotController.test("label"),e=this.hasSlotController.test("hint"),o=this.label?!0:!!t,i=this.hint?!0:!!e,r=[...this._value],s=this.parsedFormat,n=this._activeIndex,c=this.hasSelection?[Math.min(this._selectionAnchor,n),Math.max(this._selectionAnchor,n)]:null,h=0;return p`
      <label
        id="label"
        part="label"
        class=${_({label:!0,"has-label":o})}
        for="hidden-input"
        aria-hidden=${o?"false":"true"}
      >
        <slot name="label">${this.label}</slot>
      </label>

      <div
        part="segments"
        class="segments"
        role="group"
        aria-labelledby="label"
        @pointerdown=${this.handleSegmentsPointerDown}
        @click=${this.handleSegmentsClick}
      >
        ${s.map(d=>{if(d.type==="separator")return p`<span part="segment-literal" class="segment-literal" aria-hidden="true">${d.char}</span>`;let u=h++,b=r[u]??"",f=!!b,g=!this.readonly&&c!==null&&u>=c[0]&&u<c[1],v=!this.readonly&&c===null&&u===n,m=f&&this.mask;return p`
            <div
              part="segment"
              class=${_({segment:!0,"segment--active":v,"segment--selected":g,"segment--filled":f,"segment--masked":m,"segment--mask-hint":!f&&this.withMask})}
              aria-hidden="true"
            >
              ${m?"":b} ${v&&!b?p`<span class="caret"></span>`:""}
            </div>
          `})}

        <input
          id="hidden-input"
          class="hidden-input"
          type="text"
          .value=${Mt(this._value)}
          minlength=${this.effectiveLength}
          autocomplete=${this.autocomplete}
          inputmode=${this.type==="numeric"?"numeric":"text"}
          aria-describedby="hint"
          ?required=${this.required}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?autofocus=${this.autofocus}
          @input=${this.handleInput}
          @keydown=${this.handleKeyDown}
          @paste=${this.handlePaste}
          @focus=${this.handleFocus}
          @blur=${this.handleBlur}
          @select=${this.handleSelect}
        />
      </div>

      <slot
        id="hint"
        part="hint"
        name="hint"
        class=${_({hint:!0,"has-slotted":i})}
        aria-hidden=${i?"false":"true"}
        >${this.hint}</slot
      >
    `}};ft.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};ft.css=[j,pt,nc];a([S(".hidden-input")],ft.prototype,"input",2);a([S(".segments")],ft.prototype,"segmentsContainer",2);a([A()],ft.prototype,"_focused",2);a([A()],ft.prototype,"_activeIndex",2);a([A()],ft.prototype,"_selectionAnchor",2);a([l({attribute:"value",reflect:!0})],ft.prototype,"defaultValue",2);a([l({type:Number,reflect:!0})],ft.prototype,"length",2);a([l({reflect:!0})],ft.prototype,"appearance",2);a([l({reflect:!0})],ft.prototype,"type",2);a([l({type:Boolean,reflect:!0})],ft.prototype,"mask",2);a([l({reflect:!0})],ft.prototype,"case",2);a([l({reflect:!0})],ft.prototype,"size",2);a([y("size")],ft.prototype,"handleSizeChange",1);a([l()],ft.prototype,"label",2);a([l()],ft.prototype,"hint",2);a([l()],ft.prototype,"format",2);a([l({reflect:!0})],ft.prototype,"autocomplete",2);a([l({type:Boolean,reflect:!0})],ft.prototype,"required",2);a([l({type:Boolean,reflect:!0})],ft.prototype,"readonly",2);a([l({type:Boolean,reflect:!0})],ft.prototype,"autosubmit",2);a([l({type:Boolean})],ft.prototype,"autofocus",2);a([l({type:Boolean,attribute:"with-mask",reflect:!0})],ft.prototype,"withMask",2);ft=a([k("wa-otp-input")],ft);ft.disableWarning?.("change-in-update");var lc=(t="768px")=>`
  @media screen and (width < ${t}) {
    [part~='navigation'] {
      display: none;
    }

    :host(:not([disable-navigation-toggle])) slot[name~='navigation-toggle'] {
      display: contents;
    }
  }
`;var cc=C`
  :host {
    display: block;
    background-color: var(--wa-color-surface-default);
    box-sizing: border-box;
    min-height: 100%;
    --menu-width: auto;
    --main-width: 1fr;
    --aside-width: auto;
    --banner-height: 0px;
    --header-height: 0px;
    --subheader-height: 0px;
    --scroll-margin-top: calc(var(--header-height, 0px) + var(--subheader-height, 0px) + 0.5em);

    --banner-top: var(--banner-height);
    --header-top: var(--header-height);
    --subheader-top: var(--subheader-height);
  }

  slot[name]:not([name='skip-to-content'], [name='navigation-toggle'])::slotted(*) {
    display: flex;
    background-color: var(--wa-color-surface-default);
  }

  ::slotted([slot='banner']) {
    align-items: center;
    justify-content: center;
    gap: var(--wa-space-m);
    padding: var(--wa-space-xs) var(--wa-space-m);
  }

  ::slotted([slot='header']) {
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--wa-space-m);
    padding: var(--wa-space-m);
    flex: auto;
  }

  ::slotted([slot='subheader']) {
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--wa-space-m);
    padding: var(--wa-space-xs) var(--wa-space-m);
  }

  ::slotted([slot*='navigation']),
  ::slotted([slot='menu']),
  ::slotted([slot='aside']) {
    flex-direction: column;
    gap: var(--wa-space-m);
    padding: var(--wa-space-m);
  }

  ::slotted([slot='main-header']) {
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--wa-space-m);
    padding: var(--wa-space-m) var(--wa-space-3xl);
  }

  slot:not([name]) {
    /* See #331 */
    &::slotted(main),
    &::slotted(section) {
      padding: var(--wa-space-3xl);
    }
  }

  ::slotted([slot='main-footer']),
  ::slotted([slot='footer']) {
    align-items: start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--wa-space-m);
    padding: var(--wa-space-3xl);
  }

  :host([disable-sticky~='banner']) {
    --banner-top: 0px;
  }
  :host([disable-sticky~='header']) {
    --header-top: 0px;
  }
  :host([disable-sticky~='subheader']) {
    --subheader-top: 0px;
  }

  /* Nothing else depends on subheader-height. */
  :host([disable-sticky~='subheader']) {
  }
  :host([disable-sticky~='aside']) [part~='aside'],
  :host([disable-sticky~='menu']) [part~='menu'] {
    height: unset;
    max-height: unset;
  }

  :host([disable-sticky~='banner']) [part~='banner'],
  :host([disable-sticky~='header']) [part~='header'],
  :host([disable-sticky~='subheader']) [part~='subheader'],
  :host([disable-sticky~='aside']) [part~='aside'],
  :host([disable-sticky~='menu']) [part~='menu'] {
    position: static;
    overflow: unset;
    z-index: unset;
  }

  :host([disable-sticky~='aside']) [part~='aside'],
  :host([disable-sticky~='menu']) [part~='menu'] {
    height: auto;
    max-height: auto;
  }

  [part~='base'] {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: repeat(3, minmax(0, auto)) minmax(0, 1fr) minmax(0, auto);
    grid-template-columns: 100%;
    width: 100%;
    grid-template-areas:
      'banner'
      'header'
      'subheader'
      'body'
      'footer';
  }

  /* Grid areas */
  [part~='banner'] {
    grid-area: banner;
  }
  [part~='header'] {
    grid-area: header;
  }
  [part~='subheader'] {
    grid-area: subheader;
  }
  [part~='menu'] {
    grid-area: menu;
  }
  [part~='body'] {
    grid-area: body;
  }
  [part~='main'] {
    grid-area: main;
  }
  [part~='aside'] {
    grid-area: aside;
  }
  [part~='footer'] {
    grid-area: footer;
  }

  /* Z-indexes */
  [part~='banner'],
  [part~='header'],
  [part~='subheader'] {
    position: sticky;
    z-index: 5;
  }
  [part~='banner'] {
    top: 0px;
  }
  [part~='header'] {
    top: var(--banner-top);

    /** Make the header flex so that you don't unexpectedly have the default toggle button appearing above a slotted div because block elements are fun. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }
  [part~='subheader'] {
    top: calc(var(--header-top) + var(--banner-top));
  }
  [part~='body'] {
    display: grid;
    min-height: 100%;
    align-items: start;
    grid-template-columns: minmax(0, var(--menu-width)) minmax(0, var(--main-width)) minmax(0, var(--aside-width));
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: 'menu main aside';
  }
  [part~='main'] {
    display: grid;
    min-height: 100%;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
    grid-template-areas:
      'main-header'
      'main-content'
      'main-footer';
  }
  [part~='main-header'] {
    grid-area: main-header;
  }
  [part~='main-content'] {
    grid-area: main-content;
  }
  [part~='main-footer'] {
    grid-area: main-footer;
  }

  .skip-to-content {
    position: absolute;
    top: var(--wa-space-m);
    left: var(--wa-space-m);
    z-index: 6;
    border-radius: var(--wa-corners-1x);
    background-color: var(--wa-color-surface-default);
    color: var(--wa-color-text-link);
    text-decoration: none;
    padding: var(--wa-space-s) var(--wa-space-m);
    box-shadow: var(--wa-shadow-l);
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  [part~='menu'],
  [part~='aside'] {
    position: sticky;
    top: calc(var(--banner-top) + var(--header-top) + var(--subheader-top));
    z-index: 4;
    min-height: 0;
    /** Allows the menu / aside to always be 100% of the height of the main content area */
    align-self: stretch;
    max-height: calc(100dvh - var(--header-top) - var(--banner-top) - var(--subheader-top));
    overflow: auto;
  }

  [part~='navigation'] {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
  }

  [part~='drawer']::part(dialog) {
    background-color: var(--wa-color-surface-default);
  }

  /* Set these on the slot because we don't always control the navigation-toggle since that may be slotted. */
  slot[name~='navigation-toggle'],
  :host([disable-navigation-toggle]) slot[name~='navigation-toggle'] {
    display: none;
  }

  /* Sometimes the media query in the viewport is stubborn in iframes. This is an extra check to make it behave properly. */
  :host(:not([disable-navigation-toggle])[view='mobile']) slot[name~='navigation-toggle'] {
    display: contents;
  }

  [part~='navigation-toggle'] {
    /* Use only a margin-inline-start because the slotted header is expected to have default padding
        so it looks really awkward if this sets a margin-inline-end and the slotted header has a padding-inline-start. */
    margin-inline-start: var(--wa-space-m);
  }
`;var Ri=class extends Me{constructor(e){if(super(e),this.it=lt,e.type!==se.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===lt||e==null)return this._t=void 0,this.it=e;if(e===Ot)return e;if(typeof e!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;let o=[e];return o.raw=o,this._t={_$litType$:this.constructor.resultType,strings:o,values:[]}}};Ri.directiveName="unsafeHTML",Ri.resultType=1;var wo=io(Ri);function qe(t,e,o){return t?e(t):o?.(t)}function tm(t,e=document.documentElement){if(!Number.isNaN(Number(t)))return Number(t);if(!window.CSS||!CSS.registerProperty)return typeof t=="string"&&t.endsWith("px")?parseFloat(t):Number(t)||0;let o="--wa-length-resolver";if(!CSS.registerProperty.toString().includes(o))try{CSS.registerProperty({name:o,syntax:"<length>",inherits:!1,initialValue:"0px"})}catch{}let i=e.style.getPropertyValue(o);e.style.setProperty(o,t);let r=getComputedStyle(e)?.getPropertyValue(o);return e.style.setProperty(o,i),r?.endsWith("px")?parseFloat(r):Number(r)||0}function em(t){return Number.isNaN(Number(t))?t:`${t}px`}var Wt=class extends E{constructor(){super(),this.headerResizeObserver=this.slotResizeObserver("header"),this.subheaderResizeObserver=this.slotResizeObserver("subheader"),this.bannerResizeObserver=this.slotResizeObserver("banner"),this.footerResizeObserver=this.slotResizeObserver("footer"),this.handleNavigationToggle=t=>{if(this.view==="desktop"){this.hideNavigation();return}let e=t.composedPath(),o=this.navigationToggleSlot;e.find(i=>i.hasAttribute?.("data-toggle-nav")||i.assignedSlot===o||i===o)&&(t.preventDefault(),this.toggleNavigation())},this.view="desktop",this.navOpen=!1,this.mobileBreakpoint="768px",this.navigationPlacement="start",this.disableNavigationToggle=!1,this.pageResizeObserver=typeof ResizeObserver<"u"?new ResizeObserver(t=>{requestAnimationFrame(()=>{for(let e of t)if(e.contentBoxSize){let i=e.borderBoxSize[0].inlineSize,r=this.view;i>=tm(this.mobileBreakpoint)?this.view="desktop":this.view="mobile",this.requestUpdate("view",r)}})}):null,this.updateNavigationToggleState=t=>{if(t){let i=t.target.name;if(!["navigation","navigation-header","navigation-footer"].includes(i))return}let e=!!this.querySelector(":not([slot='navigation-toggle']) [data-toggle-nav]"),o=!!this.querySelector('[slot="navigation"]')||!!this.querySelector('[slot="navigation-header"]')||!!this.querySelector('[slot="navigation-footer"]');this.disableNavigationToggle=e||!o},this.addEventListener("click",this.handleNavigationToggle)}slotResizeObserver(t){return new ResizeObserver(e=>{requestAnimationFrame(()=>{for(let o of e)if(o.contentBoxSize){let i=o.borderBoxSize[0];this.style.setProperty(`--${t}-height`,`${Math.round(i.blockSize)}px`)}})})}updated(t){t.has("view")&&this.hideNavigation(),super.updated(t)}connectedCallback(){super.connectedCallback(),setTimeout(()=>{requestAnimationFrame(()=>{this.pageResizeObserver?.observe(this),this.headerResizeObserver?.observe(this.header),this.subheaderResizeObserver?.observe(this.subheader),this.bannerResizeObserver?.observe(this.banner),this.footerResizeObserver?.observe(this.footer)})})}visiblePixelsInViewport(t){if(!t)return null;let e=t.clientHeight,o=window.innerHeight,i=t.getBoundingClientRect?.();if(!i)return null;let{top:r,bottom:s}=i;return Math.max(0,r>0?Math.min(e,o-r):Math.min(s,o))}firstUpdated(){if(!document.getElementById("main-content")){let t=document.createElement("div");t.id="main-content",t.slot="skip-to-content-target",this.prepend(t)}this.shadowRoot.addEventListener("slotchange",this.updateNavigationToggleState),this.updateNavigationToggleState()}disconnectedCallback(){super.disconnectedCallback(),this.pageResizeObserver?.unobserve(this),this.headerResizeObserver?.unobserve(this.header),this.subheaderResizeObserver?.unobserve(this.subheader),this.footerResizeObserver?.unobserve(this.footer),this.bannerResizeObserver?.unobserve(this.banner)}showNavigation(){this.navOpen=!0}hideNavigation(){this.navOpen=!1}toggleNavigation(){this.navOpen=!this.navOpen}render(){return p`
      <a href="#main-content" part="skip-to-content" class="wa-visually-hidden">
        <slot name="skip-to-content">Skip to content</slot>
      </a>

      <!-- unsafeHTML needed for SSR until this is solved: https://github.com/lit/lit/issues/4696 -->
      ${wo(`
        <style id="mobile-styles">
          ${lc(em(this.mobileBreakpoint))}
        </style>
      `)}

      <div class="base" part="base page">
        <div class="banner" part="banner">
          <slot name="banner"></slot>
        </div>
        <div class="header" part="header">
          <slot name="navigation-toggle">
            <wa-button part="navigation-toggle" size="s" appearance="plain" variant="neutral">
              <slot name="navigation-toggle-icon">
                <wa-icon name="bars" part="navigation-toggle-icon" label="Toggle navigation drawer"></wa-icon>
              </slot>
            </wa-button>
          </slot>
          <slot name="header"></slot>
        </div>
        <div class="subheader" part="subheader">
          <slot name="subheader"></slot>
        </div>
        <div class="body" part="body">
          <div class="menu" part="menu">
            <slot name="menu">
              <nav name="navigation" class="navigation" part="navigation navigation-desktop">
                <!-- Add fallback divs so that CSS grid works properly. -->
                <slot name="desktop-navigation-header">
                  ${qe(this.view==="desktop",()=>p`<slot name="navigation-header"><div></div></slot>`,()=>p`<div></div>`)}
                </slot>
                <slot name="desktop-navigation">
                  ${qe(this.view==="desktop",()=>p`<slot name="navigation"><div></div></slot>`,()=>p`<div></div>`)}
                </slot>
                <slot name="desktop-navigation-footer">
                  ${qe(this.view==="desktop",()=>p`<slot name="navigation-footer"><div></div></slot>`,()=>p`<div></div>`)}
                </slot>
              </nav>
            </slot>
          </div>
          <div class="main" part="main">
            <div class="main-header" part="main-header">
              <slot name="main-header"></slot>
            </div>
            <div class="main-content" part="main-content">
              <slot name="skip-to-content-target"></slot>
              <slot></slot>
            </div>
            <div class="main-footer" part="main-footer">
              <slot name="main-footer"></slot>
            </div>
          </div>
          <div class="aside" part="aside">
            <slot name="aside"></slot>
          </div>
        </div>
        <div class="footer" part="footer">
          <slot name="footer"></slot>
        </div>
      </div>
      <wa-drawer
        part="drawer"
        placement=${this.navigationPlacement}
        light-dismiss
        ?open=${Mt(this.navOpen)}
        @wa-after-show=${()=>this.navOpen=this.navigationDrawer.open}
        @wa-after-hide=${()=>this.navOpen=this.navigationDrawer.open}
        exportparts="
          dialog:drawer__dialog,
          overlay:drawer__overlay,
          panel:drawer__panel,
          header:drawer__header,
          header-actions:drawer__header-actions,
          title:drawer__title,
          close-button:drawer__close-button,
          close-button__base:drawer__close-button__base,
          body:drawer__body,
          footer:drawer__footer
        "
        class="navigation-drawer"
      >
        <slot slot="label" part="navigation-header" name="mobile-navigation-header">
          ${qe(this.view==="mobile",()=>p`<slot name="navigation-header"><div></div></slot>`,()=>p`<div></div>`)}
        </slot>
        <slot name="mobile-navigation">
          ${qe(this.view==="mobile",()=>p`<slot name="navigation"><div></div></slot>`,()=>p`<div></div>`)}
        </slot>

        <slot slot="footer" name="mobile-navigation-footer">
          ${qe(this.view==="mobile",()=>p`<slot part="navigation-footer" name="navigation-footer"><div></div></slot>`,()=>p`<div></div>`)}
        </slot>
      </wa-drawer>
    `}};Wt.css=[Pe,cc];a([S("[part~='header']")],Wt.prototype,"header",2);a([S("[part~='menu']")],Wt.prototype,"menu",2);a([S("[part~='main']")],Wt.prototype,"main",2);a([S("[part~='aside']")],Wt.prototype,"aside",2);a([S("[part~='subheader']")],Wt.prototype,"subheader",2);a([S("[part~='footer']")],Wt.prototype,"footer",2);a([S("[part~='banner']")],Wt.prototype,"banner",2);a([S("[part~='drawer']")],Wt.prototype,"navigationDrawer",2);a([S("slot[name~='navigation-toggle']")],Wt.prototype,"navigationToggleSlot",2);a([l({attribute:"view",reflect:!0})],Wt.prototype,"view",2);a([l({attribute:"nav-open",reflect:!0,type:Boolean})],Wt.prototype,"navOpen",2);a([l({attribute:"mobile-breakpoint",type:String})],Wt.prototype,"mobileBreakpoint",2);a([l({attribute:"navigation-placement",reflect:!0})],Wt.prototype,"navigationPlacement",2);a([l({attribute:"disable-navigation-toggle",reflect:!0,type:Boolean})],Wt.prototype,"disableNavigationToggle",2);Wt=a([k("wa-page")],Wt);var hc=class extends Event{constructor(t){super("wa-page-change",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var dc=class extends Event{constructor(t){super("wa-before-page-change",{bubbles:!0,cancelable:!0,composed:!0}),this.detail=t}};var pc=C`
  @layer wa-component {
    :host {
      display: contents;
    }
  }

  .container {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    /* Sizing is relative to the current font size, so we use em rather than spacing tokens */
    gap: 1em;
  }

  .summary {
    font-size: 0.875em;
    color: var(--wa-color-text-quiet);
    white-space: nowrap;
  }

  /* Compact layout */
  .label {
    display: inline-flex;
    align-items: center;
    min-height: max(2.16em, 24px);
    padding-inline: 0.75em;
    color: var(--wa-color-text-normal);
    white-space: nowrap;
  }

  .pagination {
    display: flex;
  }

  .pages {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pages li {
    display: flex;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;

    /* Guarantee a minimum 24×24px target (WCAG 2.5.8) while still scaling with font-size. */
    min-width: max(2.16em, 24px);
    min-height: max(2.16em, 24px);
    padding-inline: 0.25em;

    font: inherit;
    font-size: inherit;
    line-height: 1;
    color: var(--wa-color-text-normal);
    text-decoration: none;

    background-color: transparent;
    /* Default (outlined) appearance */
    border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-quiet);
    border-radius: var(--wa-border-radius-m);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    transition:
      background-color var(--wa-transition-fast),
      border-color var(--wa-transition-fast),
      color var(--wa-transition-fast);
  }

  /* Ellipsis */
  .button.ellipsis {
    color: var(--wa-color-text-quiet);
    position: relative;
  }

  .button.ellipsis:hover,
  .button.ellipsis:focus-visible {
    color: var(--wa-color-text-normal);
  }

  .button:hover {
    background-color: var(--wa-color-neutral-fill-quiet);
  }

  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Current page */
  .button.current {
    font-weight: var(--wa-font-weight-bold);
    color: var(--wa-color-brand-on-loud);
    background-color: var(--wa-form-control-activated-color);
    /* Read as a solid chip: drop the outlined border so it doesn't double up against the fill. */
    border-color: transparent;
  }

  .button.current:hover {
    background-color: var(--wa-form-control-activated-color);
  }

  /* Disabled (pagination buttons use aria-disabled so they stay focusable) */
  .button[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button[aria-disabled='true']:hover {
    background-color: transparent;
  }

  wa-icon {
    font-size: 0.875em;
  }

  /* Filled */
  :host([appearance='filled']) .button {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: transparent;
  }

  :host([appearance='filled']) .button:hover {
    background-color: var(--wa-color-neutral-fill-normal);
  }

  :host([appearance='filled']) .button.current,
  :host([appearance='filled']) .button.current:hover {
    background-color: var(--wa-form-control-activated-color);
  }

  /* Plain */
  :host([appearance='plain']) .button {
    background-color: transparent;
    border-color: transparent;
  }

  :host([appearance='plain']) .button:hover {
    background-color: transparent;
  }

  :host([appearance='plain']) .button.current {
    color: var(--wa-color-brand-on-loud);
    background-color: var(--wa-form-control-activated-color);
  }
`;function Tr(t,e){let o=e-t+1;return o>0?Array.from({length:o},(i,r)=>t+r):[]}function om(t){let e=Math.max(1,Math.trunc(t.totalPages)),o=Math.min(Math.max(1,Math.trunc(t.page)),e),i=Math.max(0,Math.trunc(t.siblingCount)),r=Math.max(0,Math.trunc(t.boundaryCount));if(i*2+r*2+3>=e)return Tr(1,e).map(v=>({type:"page",value:v}));let n=r+1,c=e-r,h=o-i,d=o+i;h<n&&(d+=n-h,h=n),d>c&&(h-=d-c,d=c),h=Math.max(h,n),d=Math.min(d,c);let u=(h>n?0:1)+(d<c?0:1);for(;u>0;){if(d<c)d++;else if(h>n)h--;else break;u--}let b=h>n,f=d<c,g=[];return Tr(1,r).forEach(v=>g.push({type:"page",value:v})),b&&g.push({type:"ellipsis",position:"start"}),Tr(h,d).forEach(v=>g.push({type:"page",value:v})),f&&g.push({type:"ellipsis",position:"end"}),Tr(e-r+1,e).forEach(v=>g.push({type:"page",value:v})),g}var St=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.total=0,this.pageSize=10,this.page=1,this.siblingCount=2,this.boundaryCount=1,this.withoutNav=!1,this.withEdges=!1,this.withSummary=!1,this.format="standard",this.hrefTemplate="",this.hideSinglePage=!1,this.label="",this.appearance="outlined",this.disabled=!1,this.shouldRestoreFocus=!1}get totalPages(){return this.pageSize<=0?1:Math.max(1,Math.ceil(this.total/this.pageSize))}handleDisabledChange(){this.customStates.set("disabled",this.disabled)}handlePageBoundsChange(){let t=W(Math.trunc(this.page)||1,1,this.totalPages);t!==this.page&&(this.page=t)}getHref(t){if(this.hrefTemplate)return typeof this.hrefTemplate=="function"?this.hrefTemplate(t):this.hrefTemplate.split("{page}").join(String(t))}async requestPage(t,e){let o=W(t,1,this.totalPages);if(this.disabled||o===this.page)return;let i=new dc({page:o,pageSize:this.pageSize});this.dispatchEvent(i),!i.defaultPrevented&&(this.shouldRestoreFocus=e,this.page=o,await this.updateComplete,this.dispatchEvent(new hc({page:this.page,pageSize:this.pageSize})),this.announcePage())}restoreFocusToCurrentPage(){let t=this.shadowRoot?.querySelector('[part~="page-current"]'),e=Al();t&&e&&this.shadowRoot?.contains(e)&&t.focus()}announcePage(){kr(this.localize.term("pageXOfY",this.page,this.totalPages),"polite")}updated(){this.shouldRestoreFocus&&(this.shouldRestoreFocus=!1,this.restoreFocusToCurrentPage())}renderNavButton(t){let{part:e,targetPage:o,enabled:i,label:r,icon:s,slotName:n}=t,c=this.disabled||!i,h=this.getHref(o);return h!==void 0?p`
        <li role="listitem">
          <a
            part="button ${e}"
            class="button nav-button"
            href=${M(c?void 0:h)}
            aria-label=${r}
            aria-disabled=${c?"true":"false"}
          >
            <slot name=${n}><wa-icon library="system" name=${s}></wa-icon></slot>
          </a>
        </li>
      `:p`
      <li role="listitem">
        <button
          part="button ${e}"
          class="button nav-button"
          type="button"
          aria-label=${r}
          aria-disabled=${c?"true":"false"}
          @click=${c?null:()=>this.requestPage(o,!0)}
        >
          <slot name=${n}><wa-icon library="system" name=${s}></wa-icon></slot>
        </button>
      </li>
    `}renderPage(t){let e=t===this.page,o=this.getHref(t),i=this.localize.number(t),r=`button page${e?" page-current":""}`;return o!==void 0?p`
        <li role="listitem">
          <a
            part=${r}
            class=${_({button:!0,page:!0,current:e})}
            href=${M(e||this.disabled?void 0:o)}
            aria-current=${M(e?"page":void 0)}
            aria-disabled=${M(this.disabled?"true":void 0)}
            >${i}</a
          >
        </li>
      `:p`
      <li role="listitem">
        <button
          part=${r}
          class=${_({button:!0,page:!0,current:e})}
          type="button"
          aria-current=${M(e?"page":void 0)}
          aria-disabled=${M(this.disabled?"true":void 0)}
          @click=${this.disabled||e?null:()=>this.requestPage(t,!0)}
        >
          ${i}
        </button>
      </li>
    `}renderEllipsis(t,e){let o=St.jumpDistance,i=t==="start",r=W(i?this.page-o:this.page+o,1,this.totalPages),s=this.localize.term(i?"jumpBackwardX":"jumpForwardX",o),n=this.getHref(r),c=p`
      <wa-icon class="ellipsis-default" library="system" name="ellipsis" label=${s}></wa-icon>
    `;return n!==void 0?p`
        <li role="listitem">
          <a
            part="ellipsis"
            class="button ellipsis"
            data-ellipsis=${e}
            href=${M(this.disabled?void 0:n)}
            aria-label=${s}
            aria-disabled=${M(this.disabled?"true":void 0)}
          >
            ${c}
          </a>
        </li>
      `:p`
      <li role="listitem">
        <button
          part="ellipsis"
          class="button ellipsis"
          data-ellipsis=${e}
          type="button"
          aria-label=${s}
          aria-disabled=${M(this.disabled?"true":void 0)}
          @click=${this.disabled?null:()=>this.requestPage(r,!0)}
        >
          ${c}
        </button>
      </li>
    `}render(){let t=this.totalPages;if(this.hideSinglePage&&t<=1)return p``;let e=this.localize.dir()==="rtl",o=this.page<=1,i=this.page>=t;if(this.format==="compact")return p`
        <div class="container">
          ${this.renderSummary()}
          <nav part="base pagination" class="pagination" aria-label=${this.label||this.localize.term("pagination")}>
            <ul part="pages" class="pages" role="list">
              ${this.renderNavButton({part:"previous-button",targetPage:this.page-1,enabled:!o,label:this.localize.term("previousPage"),icon:e?"chevron-right":"chevron-left",slotName:"previous-icon"})}
              <li role="listitem">
                <span part="label" class="label" aria-current="page">
                  ${this.localize.term("compactPageXOfY",this.page,t)}
                </span>
              </li>
              ${this.renderNavButton({part:"next-button",targetPage:this.page+1,enabled:!i,label:this.localize.term("nextPage"),icon:e?"chevron-left":"chevron-right",slotName:"next-icon"})}
            </ul>
          </nav>
        </div>
      `;let r=om({page:this.page,totalPages:t,siblingCount:this.siblingCount,boundaryCount:this.boundaryCount}),s=0;return p`
      <div class="container">
        ${this.renderSummary()}
        <nav part="base pagination" class="pagination" aria-label=${this.label||this.localize.term("pagination")}>
          <ul part="pages" class="pages" role="list">
            ${this.withEdges?this.renderNavButton({part:"first-button",targetPage:1,enabled:!o,label:this.localize.term("firstPage"),icon:e?"angles-right":"angles-left",slotName:"first-icon"}):""}
            ${this.withoutNav?"":this.renderNavButton({part:"previous-button",targetPage:this.page-1,enabled:!o,label:this.localize.term("previousPage"),icon:e?"chevron-right":"chevron-left",slotName:"previous-icon"})}
            ${r.map(n=>n.type==="ellipsis"?(s++,this.renderEllipsis(n.position,s)):this.renderPage(n.value))}
            ${this.withoutNav?"":this.renderNavButton({part:"next-button",targetPage:this.page+1,enabled:!i,label:this.localize.term("nextPage"),icon:e?"chevron-left":"chevron-right",slotName:"next-icon"})}
            ${this.withEdges?this.renderNavButton({part:"last-button",targetPage:t,enabled:!i,label:this.localize.term("lastPage"),icon:e?"angles-left":"angles-right",slotName:"last-icon"}):""}
          </ul>
        </nav>
      </div>
    `}renderSummary(){if(!this.withSummary)return"";let t=this.total===0?0:(this.page-1)*this.pageSize+1,e=Math.min(this.page*this.pageSize,this.total);return p`
      <span part="summary" class="summary"> ${this.localize.term("showingXtoYofZ",t,e,this.total)} </span>
    `}};St.css=pc;St.jumpDistance=5;a([l({type:Number})],St.prototype,"total",2);a([l({attribute:"page-size",type:Number})],St.prototype,"pageSize",2);a([l({type:Number,reflect:!0})],St.prototype,"page",2);a([l({attribute:"sibling-count",type:Number})],St.prototype,"siblingCount",2);a([l({attribute:"boundary-count",type:Number})],St.prototype,"boundaryCount",2);a([l({attribute:"without-nav",type:Boolean})],St.prototype,"withoutNav",2);a([l({attribute:"with-edges",type:Boolean})],St.prototype,"withEdges",2);a([l({attribute:"with-summary",type:Boolean})],St.prototype,"withSummary",2);a([l({reflect:!0})],St.prototype,"format",2);a([l({attribute:"href-template"})],St.prototype,"hrefTemplate",2);a([l({attribute:"hide-single-page",type:Boolean})],St.prototype,"hideSinglePage",2);a([l()],St.prototype,"label",2);a([l({reflect:!0})],St.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],St.prototype,"disabled",2);a([A()],St.prototype,"shouldRestoreFocus",2);a([y("disabled",{waitUntilFirstUpdate:!0})],St.prototype,"handleDisabledChange",1);a([y("page"),y("total"),y("pageSize")],St.prototype,"handlePageBoundsChange",1);St=a([k("wa-pagination")],St);var uc=C`
  :host {
    --arrow-size: 0.375rem;
    --max-width: 25rem;
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);

    display: contents;

    /** Defaults for inherited CSS properties */
    font-size: var(--wa-font-size-m);
    line-height: var(--wa-line-height-normal);
    text-align: start;
    white-space: normal;
  }

  /* The native dialog element */
  .dialog {
    display: none;
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    overflow: visible;
    pointer-events: none;

    &:focus {
      outline: none;
    }

    &[open] {
      display: block;
    }
  }

  /* The <wa-popup> element */
  .popover {
    --arrow-size: inherit;
    --popup-border-width: var(--wa-panel-border-width);
    --show-duration: inherit;
    --hide-duration: inherit;

    pointer-events: auto;

    /* Inset box-shadow, not a border: Safari seams a clip-path edge that runs along a border. */
    &::part(arrow) {
      background-color: var(--wa-color-surface-default);
      border: none;
      box-shadow: inset calc(-1 * var(--wa-panel-border-width)) calc(-1 * var(--wa-panel-border-width)) 0 0
        var(--wa-color-surface-border);
    }
  }

  .popover[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .popover[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .popover[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .popover[placement^='right']::part(popup) {
    transform-origin: left;
  }

  /* Body */
  .body {
    display: flex;
    flex-direction: column;
    width: auto;
    max-width: min(var(--max-width), 100vw);
    padding: var(--wa-space-l);
    background-color: var(--wa-color-surface-default);
    border: var(--wa-panel-border-width) solid var(--wa-color-surface-border);
    border-radius: var(--wa-panel-border-radius);
    border-style: var(--wa-panel-border-style);
    box-shadow: var(--wa-shadow-l);
    color: var(--wa-color-text-normal);
    user-select: none;
    -webkit-user-select: none;
  }
`;var Ka=new Set,Nt=class extends E{constructor(){super(...arguments),this.anchor=null,this.placement="top",this.open=!1,this.distance=8,this.skidding=0,this.for=null,this.withoutArrow=!1,this.eventController=new AbortController,this.handleAnchorClick=()=>{this.open=!this.open},this.handleBodyClick=t=>{t.target.closest('[data-popover="close"]')&&(t.stopPropagation(),this.open=!1)},this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.open&&Dt(this)&&(t.preventDefault(),t.stopPropagation(),this.open=!1,this.anchor&&typeof this.anchor.focus=="function"&&this.anchor.focus({preventScroll:!0}))},this.handleDocumentClick=t=>{this.anchor&&t.composedPath().includes(this.anchor)||t.composedPath().includes(this)||(this.open=!1)}}connectedCallback(){super.connectedCallback(),this.id||(this.id=ee("wa-popover-")),this.eventController.signal.aborted&&(this.eventController=new AbortController),this.for&&this.anchor&&(this.anchor=null,this.handleForChange())}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleDocumentKeyDown),It(this),this.eventController.abort()}firstUpdated(){this.open&&(this.dialog.show(),this.popup.active=!0,this.popup.reposition())}updated(t){t.has("open")&&this.customStates.set("open",this.open)}async handleOpenChange(){if(this.open){let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}Ka.forEach(e=>e.open=!1),document.addEventListener("keydown",this.handleDocumentKeyDown,{signal:this.eventController.signal}),document.addEventListener("click",this.handleDocumentClick,{signal:this.eventController.signal}),this.dialog.setAttribute("open",""),this.popup.active=!0,Ka.add(this),Kt(this),requestAnimationFrame(()=>{let e=this.querySelector("[autofocus]");e&&typeof e.focus=="function"?e.focus({preventScroll:!0}):this.dialog.focus({preventScroll:!0})}),await G(this.popup.popup,"show-with-scale"),this.popup.reposition(),this.dispatchEvent(new Vt)}else{let t=new Ft;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!0;return}document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("click",this.handleDocumentClick),Ka.delete(this),It(this),await G(this.popup.popup,"hide-with-scale"),this.popup.active=!1,this.dialog.close(),this.dispatchEvent(new qt)}}handleForChange(){let t=this.getRootNode();if(!t)return;let e=this.for?t.getElementById(this.for):null,o=this.anchor;if(e===o)return;let{signal:i}=this.eventController;e&&e.addEventListener("click",this.handleAnchorClick,{signal:i}),o&&o.removeEventListener("click",this.handleAnchorClick),this.anchor=e,this.for&&!e&&console.warn(`A popover was assigned to an element with an ID of "${this.for}" but the element could not be found.`,this)}async handleOptionsChange(){this.hasUpdated&&(await this.updateComplete,this.popup.reposition())}async show(){if(!this.open)return this.open=!0,Ct(this,"wa-after-show")}async hide(){if(this.open)return this.open=!1,Ct(this,"wa-after-hide")}render(){return p`
      <dialog part="dialog" class="dialog">
        <wa-popup
          part="popup"
          exportparts="
            popup:popup__popup,
            arrow:popup__arrow
          "
          class=${_({popover:!0,"popover-open":this.open})}
          placement=${this.placement}
          distance=${this.distance}
          skidding=${this.skidding}
          flip
          shift
          shift-padding="8"
          ?arrow=${!this.withoutArrow}
          .anchor=${this.anchor}
        >
          <div part="body" class="body" @click=${this.handleBodyClick}>
            <slot></slot>
          </div>
        </wa-popup>
      </dialog>
    `}};Nt.css=uc;Nt.dependencies={"wa-popup":st};a([S("dialog")],Nt.prototype,"dialog",2);a([S(".body")],Nt.prototype,"body",2);a([S("wa-popup")],Nt.prototype,"popup",2);a([A()],Nt.prototype,"anchor",2);a([l()],Nt.prototype,"placement",2);a([l({type:Boolean,reflect:!0})],Nt.prototype,"open",2);a([l({type:Number})],Nt.prototype,"distance",2);a([l({type:Number})],Nt.prototype,"skidding",2);a([l()],Nt.prototype,"for",2);a([l({attribute:"without-arrow",type:Boolean,reflect:!0})],Nt.prototype,"withoutArrow",2);a([y("open",{waitUntilFirstUpdate:!0})],Nt.prototype,"handleOpenChange",1);a([y("for")],Nt.prototype,"handleForChange",1);a([y(["distance","placement","skidding"])],Nt.prototype,"handleOptionsChange",1);Nt=a([k("wa-popover")],Nt);var mc=C`
  :host {
    --track-height: 1rem;
    --track-color: var(--wa-color-neutral-fill-normal);
    --indicator-color: var(--wa-color-brand-fill-loud);

    display: flex;
  }

  .progress-bar {
    flex: 1 1 auto;
    display: flex;
    position: relative;
    overflow: hidden;
    height: var(--track-height);
    border-radius: var(--wa-border-radius-pill);
    background-color: var(--track-color);
    color: var(--wa-color-brand-on-loud);
    font-size: var(--wa-font-size-s);
  }

  .indicator {
    width: var(--percentage);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--indicator-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    line-height: 1;
    font-weight: var(--wa-font-weight-semibold);
    transition: all var(--wa-transition-slow, 200ms) var(--wa-transition-easing, ease);
    user-select: none;
    -webkit-user-select: none;
  }

  /* Indeterminate */
  :host([indeterminate]) .indicator {
    position: absolute;
    inset-block: 0;
    inline-size: 50%;
    animation: wa-progress-indeterminate 2.5s infinite cubic-bezier(0.37, 0, 0.63, 1);
  }

  @media (forced-colors: active) {
    .progress-bar {
      outline: solid 1px SelectedItem;
      background-color: var(--wa-color-surface-default);
    }

    .indicator {
      outline: solid 1px SelectedItem;
      background-color: SelectedItem;
    }
  }

  @keyframes wa-progress-indeterminate {
    0% {
      inset-inline-start: -50%;
    }

    75%,
    100% {
      inset-inline-start: 100%;
    }
  }
`;var qo=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.value=0,this.indeterminate=!1,this.label=""}willUpdate(t){this.style==null&&this.setStyleProperty("--percentage",`${W(this.value,0,100)}%`),super.willUpdate(t)}updated(t){t.has("value")&&requestAnimationFrame(()=>{this.style.setProperty("--percentage",`${W(this.value,0,100)}%`)}),super.updated(t)}render(){return p`
      <div
        part="base progress-bar"
        class="progress-bar"
        role="progressbar"
        title=${M(this.title)}
        aria-label=${this.label.length>0?this.label:this.localize.term("progress")}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${this.indeterminate?"0":this.value}
      >
        <div part="indicator" class="indicator">
          ${this.indeterminate?"":p` <slot part="label" class="label"></slot> `}
        </div>
      </div>
    `}};qo.css=mc;a([l({type:Number,reflect:!0})],qo.prototype,"value",2);a([l({type:Boolean,reflect:!0})],qo.prototype,"indeterminate",2);a([l()],qo.prototype,"label",2);qo=a([k("wa-progress-bar")],qo);var fc=C`
  :host {
    --size: 8rem;
    --track-width: 0.25em; /* avoid using rems here */
    --track-color: var(--wa-color-neutral-fill-normal);
    --indicator-width: var(--track-width);
    --indicator-color: var(--wa-color-brand-fill-loud);
    --indicator-transition-duration: 0.35s;

    display: inline-flex;
  }

  .progress-ring {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .image {
    width: var(--size);
    height: var(--size);
    rotate: -90deg;
    transform-origin: 50% 50%;
  }

  .track,
  .indicator {
    --radius: calc(var(--size) / 2 - max(var(--track-width), var(--indicator-width)) * 0.5);
    --circumference: calc(var(--radius) * 2 * 3.141592654);

    fill: none;
    r: var(--radius);
    cx: calc(var(--size) / 2);
    cy: calc(var(--size) / 2);
  }

  .track {
    stroke: var(--track-color);
    stroke-width: var(--track-width);
  }

  .indicator {
    stroke: var(--indicator-color);
    stroke-width: var(--indicator-width);
    stroke-linecap: round;
    transition-property: stroke-dashoffset;
    transition-duration: var(--indicator-transition-duration);
    stroke-dasharray: var(--circumference) var(--circumference);
    stroke-dashoffset: calc(var(--circumference) - var(--percentage) * var(--circumference));
  }

  .label {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
  }
`;var to=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.value=0,this.label=""}updated(t){if(super.updated(t),t.has("value")){let e=parseFloat(getComputedStyle(this.indicator).getPropertyValue("r")),o=2*Math.PI*e,i=o-this.value/100*o;this.indicatorOffset=`${i}px`}}render(){return p`
      <div
        part="base progress-ring"
        class="progress-ring"
        role="progressbar"
        aria-label=${this.label.length>0?this.label:this.localize.term("progress")}
        aria-describedby="label"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${this.value}"
        style=${ct({"--percentage":this.value/100})}
      >
        <svg class="image">
          <circle part="track" class="track"></circle>
          <circle
            part="indicator"
            class="indicator"
            style=${ct({"stroke-dashoffset":this.indicatorOffset})}
          ></circle>
        </svg>

        <slot id="label" part="label" class="label"></slot>
      </div>
    `}};to.css=fc;a([S(".indicator")],to.prototype,"indicator",2);a([A()],to.prototype,"indicatorOffset",2);a([l({type:Number,reflect:!0})],to.prototype,"value",2);a([l()],to.prototype,"label",2);to=a([k("wa-progress-ring")],to);to.disableWarning?.("change-in-update");var gc=C`
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
  }

  canvas {
    width: 100%;
    height: 100%;
    /* We force a near-instant transition so we can listen for transitionend when the color changes */
    transition: color 1ms;
  }

  span {
    /* We force a near-instant transition so we can listen for transitionend when the color changes */
    transition: color 1ms;
  }
`;var bc=function(t,e,o){},Mr=class{static render(e,o,i){bc(e,o,i)}};(function(t){function e(f,g,v,m){var z=t(v,g);z.addData(f),z.make(),m=m||0;var w=z.getModuleCount(),x=z.getModuleCount()+2*m;function $(L,T){return L-=m,T-=m,L<0||L>=w||T<0||T>=w?!1:z.isDark(L,T)}return{text:f,level:g,version:v,moduleCount:x,isDark:$}}function o(f,g,v,m,z){v=Math.max(1,v||1),m=Math.min(40,m||40);for(var w=v;w<=m;w+=1)try{return e(f,g,w,z)}catch{}}function i(f,g,v){v.background&&(g.fillStyle=v.background,g.fillRect(v.left,v.top,v.size,v.size))}function r(f,g,v,m,z,w,x,$,L,T){x?f.moveTo(g+w,v):f.moveTo(g,v);function F(K,H,nt,it,yt,wt,Lt){K?(f.lineTo(H+wt,nt+Lt),f.arcTo(H,nt,it,yt,w)):f.lineTo(H,nt)}F($,m,v,m,z,-w,0),F(L,m,z,g,z,0,-w),F(T,g,z,g,v,w,0),F(x,g,v,m,v,0,w)}function s(f,g,v,m,z,w,x,$,L,T){function F(K,H,nt,it){f.moveTo(K+nt,H),f.lineTo(K,H),f.lineTo(K,H+it),f.arcTo(K,H,K+nt,H,w)}x&&F(g,v,w,w),$&&F(m,v,-w,w),L&&F(m,z,-w,-w),T&&F(g,z,w,-w)}function n(f,g,v,m,z,w,x,$){var L=f.isDark,T=m+w,F=z+w,K=x-1,H=x+1,nt=$-1,it=$+1,yt=Math.floor(Math.min(.5,Math.max(0,v.radius))*w),wt=L(x,$),Lt=L(K,nt),zt=L(K,$),ae=L(K,it),P=L(x,it),O=L(H,it),D=L(H,$),B=L(H,nt),V=L(x,nt);m=Math.round(m),z=Math.round(z),T=Math.round(T),F=Math.round(F),wt?r(g,m,z,T,F,yt,!zt&&!V,!zt&&!P,!D&&!P,!D&&!V):s(g,m,z,T,F,yt,zt&&V&&Lt,zt&&P&&ae,D&&P&&O,D&&V&&B)}function c(f,g,v,m){var z=f.moduleCount,w=v.size/z,x=0,$=0;g.beginPath();let L=7+v.quiet;for(x=0;x<z;x+=1)for($=0;$<z;$+=1)if(($<L&&x<L||$>=z-L&&x<L||$<L&&x>=z-L)===m){var T=v.left+$*w,F=v.top+x*w,K=w;n(f,g,v,T,F,K,x,$)}h(g,v,m),g.fill()}function h(f,g,v){let m=v&&g.cornerFill||g.fill;if(typeof m=="string"){f.fillStyle=m;return}let z=m.type,w=m.position,x=m.colorStops,$;if(z==="linear-gradient"){let L=w.slice(0,4).map(T=>Math.round(T*g.size));$=f.createLinearGradient.apply(f,L)}else if(z==="radial-gradient"){let L=w.slice(0,6).map(T=>Math.round(T*g.size));$=f.createRadialGradient.apply(f,L)}else throw new Error("Unsupported fill");x.forEach(([L,T])=>{$.addColorStop(L,T)}),f.fillStyle=$}function d(f,g,v){if(f=o(v.text,v.ecLevel,v.minVersion,v.maxVersion,v.quiet),!f)return null;var m=v.context||g?.getContext("2d");return m&&(i(f,m,v),c(f,m,v,!0),c(f,m,v,!1)),g}function u(f,g){var v=document.createElement("canvas");return v.width=g.size,v.height=g.size,d(f,v,g)}var b={minVersion:1,maxVersion:40,ecLevel:"L",left:0,top:0,size:200,fill:"#000",cornerFill:null,background:null,text:"no text",radius:.5,quiet:0,image:null,imageEcCover:.5};bc=function(f,g,v){var m=Object.assign({},b,f);m.minVersion=m.minVersion,m.maxVersion=m.maxVersion,m.ecLevel=m.ecLevel,m.left=m.left,m.top=m.top,m.size=m.size,m.fill=m.fill,m.background=m.background,m.text=m.text,m.radius=m.radius,m.quiet=m.quiet,m.cornerFill=m.cornerFill||m.fill,m.image=m.image,m.imageBackground=m.imageBackground,m.imageEcCover=m.imageEcCover,m.imagePadding=m.imagePadding;var z=o(m.text,m.ecLevel,m.minVersion,m.maxVersion,m.quiet);if(!z)return;v=v||function(){};let w=function(){var x=g;if(g instanceof HTMLCanvasElement){(g.width!==m.size||g.height!==m.size)&&(g.width=m.size,g.height=m.size);let $=g.getContext("2d");$&&$.clearRect(0,0,g.width,g.height),d(z,g,m)}else if(m.context)m.context.clearRect(0,0,m.size,m.size),d(z,null,m);else if(z){let $=u(z,m);$&&(x=$,g.appendChild(x))}return x};if(m.image){let x=new Image;x.onload=function(){if(!z)return;let $=m.imageEcCover??b.imageEcCover,L=z.moduleCount-m.quiet*2,T=m.size/L,F=x.naturalWidth/x.naturalHeight,K=m.size*$;K=Math.min(K,K*F);let H=m.size*$;H=Math.min(H,H/F);let nt=L*L-172,it={L:.07,M:.15,Q:.25,H:.3}[m.ecLevel]*$*nt|0;var yt=Math.min(L,Math.sqrt(it*F)|0,K),wt=yt/F|0;wt>L&&(wt=L,yt=wt*F|0),wt=Math.min(wt,H);let Lt=z.moduleCount/2-yt/2|0,zt=z.moduleCount/2-wt/2|0,ae=z.isDark;z.isDark=function(dt,Co){return Lt<=Co&&Co<Lt+yt&&zt<=dt&&dt<zt+wt?!1:ae(dt,Co)};let P=Math.min(yt,wt*F)-m.quiet,O=Math.min(wt,yt/F)-m.quiet,D=Lt+(yt-P)/2-m.quiet,B=zt+(wt-O)/2-m.quiet,V=D*T,rt=B*T,xt=P*T,X=O*T;var ue=w();let me=ue.getContext("2d");me&&(me.fillStyle=m.imageBackground||"transparent",me.fillRect(V-4,rt-4,xt+8,X+8),me.drawImage(x,V,rt,xt,X)),v()},x.onerror=()=>{w(),v()},x.src=m.image}else w(),v()}})((function(){var t=(function(){function e(b,f){var g=236,v=17,m=b,z=i[f],w=null,x=0,$=null,L=new Array,T={},F=function(P,O){x=m*4+17,w=(function(D){for(var B=new Array(D),V=0;V<D;V+=1){B[V]=new Array(D);for(var rt=0;rt<D;rt+=1)B[V][rt]=null}return B})(x),K(0,0),K(x-7,0),K(0,x-7),it(),nt(),wt(P,O),m>=7&&yt(P),$==null&&($=ae(m,z,L)),Lt($,O)},K=function(P,O){if(w!=null){for(var D=-1;D<=7;D+=1)if(!(P+D<=-1||x<=P+D))for(var B=-1;B<=7;B+=1)O+B<=-1||x<=O+B||(0<=D&&D<=6&&(B==0||B==6)||0<=B&&B<=6&&(D==0||D==6)||2<=D&&D<=4&&2<=B&&B<=4?w[P+D][O+B]=!0:w[P+D][O+B]=!1)}},H=function(){for(var P=0,O=0,D=0;D<8;D+=1){F(!0,D);var B=s.getLostPoint(T);(D==0||P>B)&&(P=B,O=D)}return O},nt=function(){if(w){for(var P=8;P<x-8;P+=1)w[P][6]==null&&(w[P][6]=P%2==0);for(var O=8;O<x-8;O+=1)w[6][O]==null&&(w[6][O]=O%2==0)}},it=function(){if(w)for(var P=s.getPatternPosition(m),O=0;O<P.length;O+=1)for(var D=0;D<P.length;D+=1){var B=P[O],V=P[D];if(w[B][V]==null)for(var rt=-2;rt<=2;rt+=1)for(var xt=-2;xt<=2;xt+=1)w[B+rt][V+xt]=rt==-2||rt==2||xt==-2||xt==2||rt==0&&xt==0}},yt=function(P){if(w){for(var O=s.getBCHTypeNumber(m),D=0;D<18;D+=1){var B=!P&&(O>>D&1)==1;w[Math.floor(D/3)][D%3+x-8-3]=B}for(var D=0;D<18;D+=1){var B=!P&&(O>>D&1)==1;w[D%3+x-8-3][Math.floor(D/3)]=B}}},wt=function(P,O){var D=z<<3|O,B=s.getBCHTypeInfo(D);if(w){for(var V=0;V<15;V+=1){let rt=!P&&(B>>V&1)==1;w[V<6?V:V<8?V+1:x-15+V][8]=rt,w[8][V<8?x-V-1:V<9?15-V:14-V]=rt}w[x-8][8]=!P}},Lt=function(P,O){for(var D=-1,B=x-1,V=7,rt=0,xt=s.getMaskFunction(O),X=x-1;X>0;X-=2)for(X==6&&(X-=1);;){for(var ue=0;ue<2;ue+=1)if(w&&w[B][X-ue]==null){var me=!1;rt<P.length&&(me=(P[rt]>>>V&1)==1);var dt=xt(B,X-ue);dt&&(me=!me),w[B][X-ue]=me,V-=1,V==-1&&(rt+=1,V=7)}if(B+=D,B<0||x<=B){B-=D,D=-D;break}}},zt=function(P,O){for(var D=0,B=0,V=0,rt=new Array(O.length),xt=new Array(O.length),X=0;X<O.length;X+=1){var ue=O[X].dataCount,me=O[X].totalCount-ue;B=Math.max(B,ue),V=Math.max(V,me),rt[X]=new Array(ue);for(var dt=0;dt<rt[X].length;dt+=1)rt[X][dt]=255&P.getBuffer()[dt+D];D+=ue;var Co=s.getErrorCorrectPolynomial(me),ph=c(rt[X],Co.getLength()-1),is=ph.mod(Co);xt[X]=new Array(Co.getLength()-1);for(var dt=0;dt<xt[X].length;dt+=1){var rs=dt+is.getLength()-xt[X].length;xt[X][dt]=rs>=0?is.getAt(rs):0}}for(var as=0,dt=0;dt<O.length;dt+=1)as+=O[dt].totalCount;for(var Fr=new Array(as),Fi=0,dt=0;dt<B;dt+=1)for(var X=0;X<O.length;X+=1)dt<rt[X].length&&(Fr[Fi]=rt[X][dt],Fi+=1);for(var dt=0;dt<V;dt+=1)for(var X=0;X<O.length;X+=1)dt<xt[X].length&&(Fr[Fi]=xt[X][dt],Fi+=1);return Fr},ae=function(P,O,D){for(var B=h.getRSBlocks(P,O),V=d(),rt=0;rt<D.length;rt+=1){var xt=D[rt];V.put(xt.getMode(),4),V.put(xt.getLength(),s.getLengthInBits(xt.getMode(),P)),xt.write(V)}for(var X=0,rt=0;rt<B.length;rt+=1)X+=B[rt].dataCount;if(V.getLengthInBits()>X*8)throw new Error("code length overflow. ("+V.getLengthInBits()+">"+X*8+")");for(V.getLengthInBits()+4<=X*8&&V.put(0,4);V.getLengthInBits()%8!=0;)V.putBit(!1);for(;!(V.getLengthInBits()>=X*8||(V.put(g,8),V.getLengthInBits()>=X*8));)V.put(v,8);return zt(V,B)};return T.addData=function(P){var O=u(P);L.push(O),$=null},T.isDark=function(P,O){if(!w)throw new Error("_modules is null");if(P<0||x<=P||O<0||x<=O)throw new Error(P+","+O);return w[P][O]},T.getModuleCount=function(){return x},T.make=function(){F(!1,H())},T}e.stringToBytes=function(b){return new TextEncoder().encode(b)};var o={MODE_8BIT_BYTE:4},i={L:1,M:0,Q:3,H:2},r={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},s=(function(){var b=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],f=1335,g=7973,v=21522,m={},z=function(w){for(var x=0;w!=0;)x+=1,w>>>=1;return x};return m.getBCHTypeInfo=function(w){for(var x=w<<10;z(x)-z(f)>=0;)x^=f<<z(x)-z(f);return(w<<10|x)^v},m.getBCHTypeNumber=function(w){for(var x=w<<12;z(x)-z(g)>=0;)x^=g<<z(x)-z(g);return w<<12|x},m.getPatternPosition=function(w){return b[w-1]},m.getMaskFunction=function(w){switch(w){case r.PATTERN000:return function(x,$){return(x+$)%2==0};case r.PATTERN001:return function(x,$){return x%2==0};case r.PATTERN010:return function(x,$){return $%3==0};case r.PATTERN011:return function(x,$){return(x+$)%3==0};case r.PATTERN100:return function(x,$){return(Math.floor(x/2)+Math.floor($/3))%2==0};case r.PATTERN101:return function(x,$){return x*$%2+x*$%3==0};case r.PATTERN110:return function(x,$){return(x*$%2+x*$%3)%2==0};case r.PATTERN111:return function(x,$){return(x*$%3+(x+$)%2)%2==0};default:throw new Error("bad maskPattern:"+w)}},m.getErrorCorrectPolynomial=function(w){for(var x=c([1],0),$=0;$<w;$+=1)x=x.multiply(c([1,n.gexp($)],0));return x},m.getLengthInBits=function(w,x){if(w!=o.MODE_8BIT_BYTE||x<1||x>40)throw new Error("mode: "+w+"; type: "+x);return x<10?8:16},m.getLostPoint=function(w){for(var x=w.getModuleCount(),$=0,L=0;L<x;L+=1)for(var T=0;T<x;T+=1){for(var F=0,K=w.isDark(L,T),H=-1;H<=1;H+=1)if(!(L+H<0||x<=L+H))for(var nt=-1;nt<=1;nt+=1)T+nt<0||x<=T+nt||H==0&&nt==0||K==w.isDark(L+H,T+nt)&&(F+=1);F>5&&($+=3+F-5)}for(var L=0;L<x-1;L+=1)for(var T=0;T<x-1;T+=1){var it=0;w.isDark(L,T)&&(it+=1),w.isDark(L+1,T)&&(it+=1),w.isDark(L,T+1)&&(it+=1),w.isDark(L+1,T+1)&&(it+=1),(it==0||it==4)&&($+=3)}for(var L=0;L<x;L+=1)for(var T=0;T<x-6;T+=1)w.isDark(L,T)&&!w.isDark(L,T+1)&&w.isDark(L,T+2)&&w.isDark(L,T+3)&&w.isDark(L,T+4)&&!w.isDark(L,T+5)&&w.isDark(L,T+6)&&($+=40);for(var T=0;T<x;T+=1)for(var L=0;L<x-6;L+=1)w.isDark(L,T)&&!w.isDark(L+1,T)&&w.isDark(L+2,T)&&w.isDark(L+3,T)&&w.isDark(L+4,T)&&!w.isDark(L+5,T)&&w.isDark(L+6,T)&&($+=40);for(var yt=0,T=0;T<x;T+=1)for(var L=0;L<x;L+=1)w.isDark(L,T)&&(yt+=1);var wt=Math.abs(100*yt/x/x-50)/5;return $+=wt*10,$},m})(),n=(function(){for(var b=new Array(256),f=new Array(256),g=0;g<8;g+=1)f[g]=1<<g;for(var g=8;g<256;g+=1)f[g]=f[g-4]^f[g-5]^f[g-6]^f[g-8];for(var g=0;g<255;g+=1)b[f[g]]=g;var v={};return v.glog=function(m){if(m<1)throw new Error("glog("+m+")");return b[m]},v.gexp=function(m){for(;m<0;)m+=255;for(;m>=256;)m-=255;return f[m]},v})();function c(b,f){if(typeof b.length>"u")throw new Error(b.length+"/"+f);var g=(function(){for(var m=0;m<b.length&&b[m]==0;)m+=1;for(var z=new Array(b.length-m+f),w=0;w<b.length-m;w+=1)z[w]=b[w+m];return z})(),v={};return v.getAt=function(m){return g[m]},v.getLength=function(){return g.length},v.multiply=function(m){for(var z=new Array(v.getLength()+m.getLength()-1),w=0;w<v.getLength();w+=1)for(var x=0;x<m.getLength();x+=1)z[w+x]^=n.gexp(n.glog(v.getAt(w))+n.glog(m.getAt(x)));return c(z,0)},v.mod=function(m){if(v.getLength()-m.getLength()<0)return v;for(var z=n.glog(v.getAt(0))-n.glog(m.getAt(0)),w=new Array(v.getLength()),x=0;x<v.getLength();x+=1)w[x]=v.getAt(x);for(var x=0;x<m.getLength();x+=1)w[x]^=n.gexp(n.glog(m.getAt(x))+z);return c(w,0).mod(m)},v}var h=(function(){var b=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],f=function(m,z){var w={};return w.totalCount=m,w.dataCount=z,w},g={},v=function(m,z){switch(z){case i.L:return b[(m-1)*4+0];case i.M:return b[(m-1)*4+1];case i.Q:return b[(m-1)*4+2];case i.H:return b[(m-1)*4+3];default:return}};return g.getRSBlocks=function(m,z){var w=v(m,z);if(typeof w>"u")throw new Error("bad rs block @ typeNumber:"+m+"/errorCorrectLevel:"+z);for(var x=w.length/3,$=new Array,L=0;L<x;L+=1)for(var T=w[L*3+0],F=w[L*3+1],K=w[L*3+2],H=0;H<T;H+=1)$.push(f(F,K));return $},g})(),d=function(){var b=new Array,f=0,g={};return g.getBuffer=function(){return b},g.getAt=function(v){var m=Math.floor(v/8);return(b[m]>>>7-v%8&1)==1},g.put=function(v,m){for(var z=0;z<m;z+=1)g.putBit((v>>>m-z-1&1)==1)},g.getLengthInBits=function(){return f},g.putBit=function(v){var m=Math.floor(f/8);b.length<=m&&b.push(0),v&&(b[m]|=128>>>f%8),f+=1},g},u=function(b){var f=o.MODE_8BIT_BYTE,g=e.stringToBytes(b),v={};return v.getMode=function(){return f},v.getLength=function(m){return g.length},v.write=function(m){for(var z=0;z<g.length;z+=1)m.put(g[z],8)},v};return e})();return t})());var Gt=class extends E{constructor(){super(...arguments),this.value="",this.label="",this.size=128,this.fill="",this.background="",this.radius=0,this.errorCorrection="H",this.image=null,this.imageBackground=null,this.imageCoverage=null,this.imagePadding=null,this.computedStyle=null}updated(t){super.updated(t),this.generate()}generate(){if(!this.hasUpdated)return;this.canvas.style.maxWidth=`${this.size}px`,this.canvas.style.maxHeight=`${this.size}px`,this.computedStyle||(this.computedStyle=getComputedStyle(this));let t=this.computedStyle,e=this.shadowRoot?.querySelector("span");e&&(this.spanComputedStyle||(this.spanComputedStyle=getComputedStyle(e))),Mr.render({text:this.value,radius:this.radius,ecLevel:this.errorCorrection,fill:this.fill||t.color,background:this.background||null,size:this.size*2,image:this.image,imageEcCover:this.imageCoverage,imagePadding:this.imagePadding,imageBackground:this.imageBackground||this.background,cornerFill:this.spanComputedStyle?.color},this.canvas)}render(){return p`
      <canvas
        part="base qr-code"
        class="qr-code"
        role="img"
        aria-label=${this.label?.length>0?this.label:this.value}
        style=${ct({maxWidth:`${this.size}px`,maxHeight:`${this.size}px`,minWidth:`${this.size}px`,minHeight:`${this.size}px`})}
        @transitionend=${t=>{t.propertyName==="color"&&this.generate()}}
      >
        <span style="color: var(--corner-color);"></span>
      </canvas>
    `}};Gt.css=gc;a([S("canvas")],Gt.prototype,"canvas",2);a([l()],Gt.prototype,"value",2);a([l()],Gt.prototype,"label",2);a([l({type:Number})],Gt.prototype,"size",2);a([l()],Gt.prototype,"fill",2);a([l()],Gt.prototype,"background",2);a([l({type:Number})],Gt.prototype,"radius",2);a([l({attribute:"error-correction"})],Gt.prototype,"errorCorrection",2);a([l()],Gt.prototype,"image",2);a([l({attribute:"image-background"})],Gt.prototype,"imageBackground",2);a([l({attribute:"image-coverage",type:Number})],Gt.prototype,"imageCoverage",2);a([l({attribute:"image-padding",type:Number})],Gt.prototype,"imagePadding",2);Gt=a([k("wa-qr-code")],Gt);var vc=C`
  :host {
    --checked-icon-color: var(--wa-form-control-activated-color);
    --checked-icon-scale: 0.7;

    color: var(--wa-form-control-value-color);
    display: inline-flex;
    flex-direction: row;
    align-items: top;
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  :host(:focus) {
    outline: none;
  }

  /* When the control isn't checked, hide the circle for Windows High Contrast mode a11y */
  :host(:not(:state(checked))) svg circle {
    opacity: 0;
  }

  [part~='label'] {
    display: inline;
  }

  [part~='hint'] {
    margin-block-start: 0.5em;
  }

  /* Default spacing for default appearance radios */
  :host([appearance='default']) {
    margin-block: 0.375em; /* Half of the original 0.75em gap on each side */
  }

  :host([appearance='default'][data-wa-radio-horizontal]) {
    margin-block: 0;
    margin-inline: 0.5em; /* Half of the original 1em gap on each side */
  }

  /* Remove margin from first/last items to prevent extra space */
  :host([appearance='default'][data-wa-radio-first]) {
    margin-block-start: 0;
    margin-inline-start: 0;
  }

  :host([appearance='default'][data-wa-radio-last]) {
    margin-block-end: 0;
    margin-inline-end: 0;
  }

  /* Button appearance have no spacing, they get handled by the overlap margins below */
  :host([appearance='button']) {
    margin: 0;
    align-items: center;
    min-height: var(--wa-form-control-height);
    background-color: var(--wa-color-surface-default);
    border: var(--wa-form-control-border-width) var(--wa-form-control-border-style) var(--wa-form-control-border-color);
    border-radius: var(--wa-border-radius-m);
    padding: 0 var(--wa-form-control-padding-inline);
    transition:
      background-color var(--wa-transition-fast),
      border-color var(--wa-transition-fast);
  }

  /* Default appearance */
  :host([appearance='default']) {
    .control {
      flex: 0 0 auto;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--wa-form-control-toggle-size);
      height: var(--wa-form-control-toggle-size);
      border-color: var(--wa-form-control-border-color);
      border-radius: 50%;
      border-style: var(--wa-form-control-border-style);
      border-width: var(--wa-form-control-border-width);
      background-color: var(--wa-form-control-background-color);
      color: transparent;
      transition:
        background var(--wa-transition-normal),
        border-color var(--wa-transition-fast),
        box-shadow var(--wa-transition-fast),
        color var(--wa-transition-fast);
      transition-timing-function: var(--wa-transition-easing);

      margin-inline-end: 0.5em;
    }

    .checked-icon {
      display: flex;
      fill: currentColor;
      width: var(--wa-form-control-toggle-size);
      height: var(--wa-form-control-toggle-size);
      scale: var(--checked-icon-scale);
    }
  }

  /* Button appearance */
  :host([appearance='button']) {
    .control {
      display: none;
    }
  }

  /* Checked */
  :host(:state(checked)) .control {
    color: var(--checked-icon-color);
    border-color: var(--wa-form-control-activated-color);
    background-color: var(--wa-form-control-background-color);
  }

  /* Focus */
  :host(:focus-visible) .control {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Disabled */
  :host(:state(disabled)) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Horizontal grouping - remove inner border radius */
  :host([appearance='button'][data-wa-radio-horizontal][data-wa-radio-inner]) {
    border-radius: 0;
  }

  :host([appearance='button'][data-wa-radio-horizontal][data-wa-radio-first]) {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :host([appearance='button'][data-wa-radio-horizontal][data-wa-radio-last]) {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  /* Vertical grouping - remove inner border radius */
  :host([appearance='button'][data-wa-radio-vertical][data-wa-radio-inner]) {
    border-radius: 0;
  }

  :host([appearance='button'][data-wa-radio-vertical][data-wa-radio-first]) {
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }

  :host([appearance='button'][data-wa-radio-vertical][data-wa-radio-last]) {
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  }

  @media (hover: hover) {
    :host([appearance='button']:hover:not(:state(disabled), :state(checked))) {
      background-color: color-mix(in srgb, var(--wa-color-surface-default) 95%, var(--wa-color-mix-hover));
    }
  }

  :host([appearance='button']:focus-visible) {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  :host([appearance='button']:state(checked)) {
    border-color: var(--wa-form-control-activated-color);
    background-color: var(--wa-color-brand-fill-quiet);
  }

  :host([appearance='button']:state(checked):focus-visible) {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Button overlap margins */
  :host([appearance='button'][data-wa-radio-horizontal]:not([data-wa-radio-first])) {
    margin-inline-start: calc(-1 * var(--wa-form-control-border-width));
  }

  :host([appearance='button'][data-wa-radio-vertical]:not([data-wa-radio-first])) {
    margin-block-start: calc(-1 * var(--wa-form-control-border-width));
  }

  /* Ensure interactive states are visible above adjacent buttons */
  :host([appearance='button']:hover),
  :host([appearance='button']:state(checked)) {
    position: relative;
    z-index: 1;
  }

  :host([appearance='button']:focus-visible) {
    z-index: 2;
  }
`;var Ce=class extends q{constructor(){super(),this.checked=!1,this.forceDisabled=!1,this.appearance="default",this.disabled=!1,this.handleClick=()=>{!this.disabled&&!this.forceDisabled&&(this.checked=!0)},this.addEventListener("click",this.handleClick)}handleSizeChange(){U(this.localName,this.size)}connectedCallback(){super.connectedCallback(),this.setInitialAttributes()}setInitialAttributes(){this.setAttribute("role","radio"),this.tabIndex=0,this.setAttribute("aria-disabled",this.disabled||this.forceDisabled?"true":"false")}updated(t){if(super.updated(t),t.has("checked")&&(this.customStates.set("checked",this.checked),this.setAttribute("aria-checked",this.checked?"true":"false"),!this.disabled&&!this.forceDisabled&&(this.tabIndex=this.checked?0:-1)),t.has("disabled")||t.has("forceDisabled")){let e=this.disabled||this.forceDisabled;this.customStates.set("disabled",e),this.setAttribute("aria-disabled",e?"true":"false"),e?this.tabIndex=-1:this.tabIndex=this.checked?0:-1}}setValue(){}render(){return p`
      <span part="control" class="control">
        ${this.checked?p`
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" part="checked-icon" class="checked-icon">
                <circle cx="8" cy="8" r="8" />
              </svg>
            `:""}
      </span>

      <slot part="label" class="label"></slot>
    `}};Ce.css=[pt,j,vc];a([A()],Ce.prototype,"checked",2);a([A()],Ce.prototype,"forceDisabled",2);a([l({reflect:!0})],Ce.prototype,"value",2);a([l({reflect:!0})],Ce.prototype,"appearance",2);a([l({reflect:!0})],Ce.prototype,"size",2);a([y("size")],Ce.prototype,"handleSizeChange",1);a([l({type:Boolean})],Ce.prototype,"disabled",2);Ce=a([k("wa-radio")],Ce);Ce.disableWarning?.("change-in-update");var wc=C`
  .form-control {
    position: relative;
    border: none;
    padding: 0;
    margin: 0;
  }

  .label {
    padding: 0;
  }

  .radio-group-required .label::after {
    content: var(--wa-form-control-required-content);
    margin-inline-start: var(--wa-form-control-required-content-offset);
  }

  [part~='form-control-input'] {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: 0; /* Radios handle their own spacing */
  }

  /* Horizontal */
  :host([orientation='horizontal']) [part~='form-control-input'] {
    flex-direction: row;
  }

  /* Help text */
  [part~='hint'] {
    margin-block-start: 0.5em;
  }
`;var Pt=class extends q{constructor(){super(),this.hasSlotController=new Z(this,"hint","label"),this.label="",this.hint="",this.name=null,this.disabled=!1,this.orientation="vertical",this._value=null,this.defaultValue=this.getAttribute("value")||null,this.required=!1,this.withLabel=!1,this.withHint=!1,this.handleRadioClick=t=>{let e=t.target.closest("wa-radio");if(!e||e.disabled||e.forceDisabled||this.disabled)return;let o=this.value;this.value=e.value,e.checked=!0;let i=this.getAllRadios();for(let r of i)e!==r&&(r.checked=!1,r.setAttribute("tabindex","-1"));this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})},this.addEventListener("keydown",this.handleKeyDown),this.addEventListener("click",this.handleRadioClick)}static get validators(){let t=[oe({validationElement:Object.assign(document.createElement("input"),{required:!0,type:"radio",name:ee("__wa-radio")})})];return[...super.validators,...t]}get value(){return this.valueHasChanged?this._value:this._value??this.defaultValue}set value(t){typeof t=="number"&&(t=String(t)),this.valueHasChanged=!0,this._value=t}handleSizeChange(){U(this.localName,this.size)}get validationTarget(){if(!1)return;let t=this.querySelector(":is(wa-radio):not([disabled])");if(t)return t}updated(t){(t.has("disabled")||t.has("size")||t.has("value")||t.has("defaultValue"))&&this.syncRadioElements()}formResetCallback(...t){this._value=null,super.formResetCallback(...t),this.syncRadioElements()}getAllRadios(){return[...this.querySelectorAll("wa-radio")]}handleLabelClick(){this.focus()}async syncRadioElements(){let t=this.getAllRadios();if(t.forEach((e,o)=>{this.size&&e.setAttribute("size",this.size),e.toggleAttribute("data-wa-radio-horizontal",this.orientation!=="vertical"),e.toggleAttribute("data-wa-radio-vertical",this.orientation==="vertical"),e.toggleAttribute("data-wa-radio-first",o===0),e.toggleAttribute("data-wa-radio-inner",o!==0&&o!==t.length-1),e.toggleAttribute("data-wa-radio-last",o===t.length-1),e.forceDisabled=this.disabled}),await Promise.all(t.map(async e=>{await e.updateComplete,!e.disabled&&e.value===this.value?e.checked=!0:e.checked=!1})),this.disabled)t.forEach(e=>{e.tabIndex=-1});else{let e=t.filter(i=>!i.disabled),o=e.find(i=>i.checked);e.length>0&&(o?e.forEach(i=>{i.tabIndex=i.checked?0:-1}):e.forEach((i,r)=>{i.tabIndex=r===0?0:-1})),t.filter(i=>i.disabled).forEach(i=>{i.tabIndex=-1})}}handleKeyDown(t){if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(t.key)||this.disabled)return;let e=this.getAllRadios().filter(c=>!c.disabled);if(e.length<=0)return;t.preventDefault();let o=this.value,i=e.find(c=>c.checked)??e[0],r=t.key===" "?0:["ArrowUp","ArrowLeft"].includes(t.key)?-1:1,s=e.indexOf(i)+r;s||(s=0),s<0&&(s=e.length-1),s>e.length-1&&(s=0);let n=e.some(c=>c.tagName.toLowerCase()==="wa-radio-button");this.getAllRadios().forEach(c=>{c.checked=!1,n||c.setAttribute("tabindex","-1")}),this.value=e[s].value,e[s].checked=!0,n?e[s].shadowRoot.querySelector("button").focus():(e[s].setAttribute("tabindex","0"),e[s].focus()),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),t.preventDefault()}focus(t){if(this.disabled)return;let e=this.getAllRadios(),o=e.find(s=>s.checked),i=e.find(s=>!s.disabled),r=o||i;r&&r.focus(t)}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e;return p`
      <fieldset
        part="form-control"
        class=${_({"form-control":!0,"form-control-radio-group":!0,"form-control-has-label":o})}
        role="radiogroup"
        aria-labelledby="label"
        aria-describedby="hint"
        aria-errormessage="error-message"
        aria-orientation=${this.orientation}
      >
        <label
          part="form-control-label"
          id="label"
          class=${_({label:!0,"has-label":o})}
          aria-hidden=${o?"false":"true"}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <slot part="form-control-input" @slotchange=${this.syncRadioElements}></slot>

        <slot
          id="hint"
          name="hint"
          part="hint"
          class=${_({"has-slotted":i})}
          aria-hidden=${i?"false":"true"}
          >${this.hint}</slot
        >
      </fieldset>
    `}};Pt.css=[j,pt,wc];Pt.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S("slot:not([name])")],Pt.prototype,"defaultSlot",2);a([l()],Pt.prototype,"label",2);a([l({attribute:"hint"})],Pt.prototype,"hint",2);a([l({reflect:!0})],Pt.prototype,"name",2);a([l({type:Boolean,reflect:!0})],Pt.prototype,"disabled",2);a([l({reflect:!0})],Pt.prototype,"orientation",2);a([A()],Pt.prototype,"value",1);a([l({attribute:"value",reflect:!0})],Pt.prototype,"defaultValue",2);a([l({reflect:!0})],Pt.prototype,"size",2);a([y("size")],Pt.prototype,"handleSizeChange",1);a([l({type:Boolean,reflect:!0})],Pt.prototype,"required",2);a([l({type:Boolean,attribute:"with-label"})],Pt.prototype,"withLabel",2);a([l({type:Boolean,attribute:"with-hint"})],Pt.prototype,"withHint",2);Pt=a([k("wa-radio-group")],Pt);Pt.disableWarning?.("change-in-update");var yc=class extends Event{constructor(t){super("wa-content-change",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var xc=C`
  :host {
    display: contents;
  }

  /*
   * Force-hide unselected children. A bare [hidden] (display: none from the UA sheet) loses to any
   * author display set on the child — a utility class like .wa-flank, or a component's own
   * :host display — so children with their own layout wouldn't actually hide without this.
   */
  ::slotted([hidden]) {
    display: none !important;
  }

  /*
   * @keyframes are defined in both document scope (random-content.ts) and here:
   * Chromium resolves animation-name from the document for slotted elements;
   * WebKit resolves it from the shadow root. Both copies are needed.
   */

  @keyframes wa-rc-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes wa-rc-fade-up {
    from {
      opacity: 0;
      transform: translateY(var(--animation-translate, 0.5em));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes wa-rc-fade-down {
    from {
      opacity: 0;
      transform: translateY(calc(-1 * var(--animation-translate, 0.5em)));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes wa-rc-fade-left {
    from {
      opacity: 0;
      transform: translateX(var(--animation-translate, 0.5em));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes wa-rc-fade-right {
    from {
      opacity: 0;
      transform: translateX(calc(-1 * var(--animation-translate, 0.5em)));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* The JS already skips animations under reduced motion; this guards CSS-only consumers too. */
  @media (prefers-reduced-motion: no-preference) {
    ::slotted([data-wa-animation]) {
      animation-duration: var(--animation-duration, 300ms);
      animation-timing-function: var(--animation-easing, ease);
      animation-fill-mode: both;
    }

    ::slotted([data-wa-animation='fade']) {
      animation-name: wa-rc-fade;
    }

    ::slotted([data-wa-animation='fade-up']) {
      animation-name: wa-rc-fade-up;
    }

    ::slotted([data-wa-animation='fade-down']) {
      animation-name: wa-rc-fade-down;
    }

    ::slotted([data-wa-animation='fade-left']) {
      animation-name: wa-rc-fade-left;
    }

    ::slotted([data-wa-animation='fade-right']) {
      animation-name: wa-rc-fade-right;
    }
  }
`;if(typeof document<"u"){let t=new CSSStyleSheet;t.replaceSync(`
    @keyframes wa-rc-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes wa-rc-fade-up {
      from { opacity: 0; transform: translateY(var(--animation-translate, 0.5em)); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes wa-rc-fade-down {
      from { opacity: 0; transform: translateY(calc(-1 * var(--animation-translate, 0.5em))); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes wa-rc-fade-left {
      from { opacity: 0; transform: translateX(var(--animation-translate, 0.5em)); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes wa-rc-fade-right {
      from { opacity: 0; transform: translateX(calc(-1 * var(--animation-translate, 0.5em))); }
      to { opacity: 1; transform: translateX(0); }
    }
  `),document.adoptedStyleSheets=[...document.adoptedStyleSheets,t]}var de=class extends E{constructor(){super(...arguments),this.sequenceCursor=0,this.uniqueQueue=[],this.currentSelection=new Set,this.isInitialSelection=!0,this.autoplayController=new sr(this,()=>this.randomize()),this.animationCleanups=new WeakMap,this.liveAnnouncement="",this.items=1,this.mode="unique",this.autoplay=!1,this.autoplayInterval=3e3,this.animation="none"}connectedCallback(){super.connectedCallback(),this.hasUpdated&&this.syncAutoplay()}firstUpdated(t){super.firstUpdated(t),this.syncAutoplay()}handleAutoplayChange(){this.syncAutoplay()}handleModeChange(){this.sequenceCursor=0,this.uniqueQueue=[],this.currentSelection.clear(),this.randomize()}handleItemsChange(){this.uniqueQueue=[],this.randomize()}randomize(){let t=this.assignedChildren();if(!t.length)return[];let e=Math.min(Math.max(1,this.items),t.length),o;if(this.mode==="sequence")o=[],Array.from({length:e}).forEach((s,n)=>{o.push(t[(this.sequenceCursor+n)%t.length])}),this.sequenceCursor=(this.sequenceCursor+e)%t.length;else if(this.mode==="unique"){if(this.uniqueQueue.length<e){let s=new Set(this.uniqueQueue),n=t.filter(h=>!this.currentSelection.has(h)&&!s.has(h)),c=t.filter(h=>this.currentSelection.has(h)&&!s.has(h));this.uniqueQueue.push(...this.sample(n,n.length),...this.sample(c,c.length)),this.uniqueQueue.length<e&&(this.uniqueQueue=this.sample([...t],t.length))}o=this.uniqueQueue.splice(0,e),this.currentSelection=new Set(o)}else{let s=t.filter(n=>!this.currentSelection.has(n));o=this.sample(s.length>=e?s:t,e),this.currentSelection=new Set(o)}let i=o[0],r=o[o.length-1];return t.forEach(s=>{let n=s,c=o.includes(s);delete n.dataset.waAnimation,n.style.display="",n.hidden=!c,n.style.marginBlockStart=c&&s===i?"0":"",n.style.marginBlockEnd=c&&s===r?"0":""}),this.animation!=="none"&&!$o()&&o.forEach(s=>{let n=s;this.animation!=="fade"&&getComputedStyle(s).display==="inline"&&(n.style.display="inline-block"),s.getAnimations().forEach(h=>h.cancel()),n.dataset.waAnimation=this.animation,this.animationCleanups.get(s)?.abort();let c=new AbortController;this.animationCleanups.set(s,c),n.addEventListener("animationend",()=>delete n.dataset.waAnimation,{once:!0,signal:c.signal})}),this.isInitialSelection?this.isInitialSelection=!1:this.liveAnnouncement=o.map(s=>s.textContent?.trim()).filter(Boolean).join(", "),this.dispatchEvent(new yc({items:o})),o}syncAutoplay(){this.autoplayController.stop(),this.autoplay&&this.autoplayInterval>0&&this.autoplayController.start(this.autoplayInterval)}assignedChildren(){return this.shadowRoot?.querySelector("slot")?.assignedElements()??[]}sample(t,e){let o=[...t];return Array.from({length:e}).forEach((i,r)=>{let s=r+Math.floor(Math.random()*(o.length-r));[o[r],o[s]]=[o[s],o[r]]}),o.slice(0,e)}handleSlotChange(){this.randomize()}render(){return p`
      <slot @slotchange=${this.handleSlotChange}></slot>
      <div class="wa-visually-hidden" role="status" aria-live="polite" aria-atomic="true">${this.liveAnnouncement}</div>
    `}};de.css=[xc,Pe];a([A()],de.prototype,"liveAnnouncement",2);a([l({type:Number})],de.prototype,"items",2);a([l({reflect:!0})],de.prototype,"mode",2);a([l({type:Boolean,reflect:!0})],de.prototype,"autoplay",2);a([l({type:Number,attribute:"autoplay-interval"})],de.prototype,"autoplayInterval",2);a([l({reflect:!0})],de.prototype,"animation",2);a([y(["autoplay","autoplayInterval"],{waitUntilFirstUpdate:!0})],de.prototype,"handleAutoplayChange",1);a([y("mode",{waitUntilFirstUpdate:!0})],de.prototype,"handleModeChange",1);a([y("items",{waitUntilFirstUpdate:!0})],de.prototype,"handleItemsChange",1);de=a([k("wa-random-content")],de);var Xa=class extends Event{constructor(t){super("wa-hover",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Cc=C`
  :host {
    --symbol-color: var(--wa-color-neutral-on-quiet);
    --symbol-color-active: var(--wa-color-yellow-70);
    --symbol-spacing: 0.125em;

    display: inline-flex;
    border-radius: var(--wa-border-radius-m);
    vertical-align: middle;
    touch-action: none;
  }

  :host(:focus) {
    outline: none;
  }

  :host(:focus-visible) {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  .rating {
    position: relative;
    display: inline-flex;
  }

  .symbols {
    display: inline-flex;
    gap: 0.125em;
    position: relative;
    line-height: 0;
    color: var(--symbol-color);
    white-space: nowrap;
    cursor: pointer;
  }

  .symbols > * {
    padding: var(--symbol-spacing);
  }

  .symbol-active,
  .partial-filled {
    color: var(--symbol-color-active);
  }

  .partial-symbol-container {
    position: relative;
  }

  .partial-filled {
    position: absolute;
    top: var(--symbol-spacing);
    left: var(--symbol-spacing);
  }

  .symbol {
    transition: scale var(--wa-transition-normal) var(--wa-transition-easing);
    pointer-events: none;
  }

  .symbol-hover {
    scale: 1.2;
  }

  .rating-readonly .symbols {
    cursor: default;
  }

  :host([disabled]) .symbol-hover,
  .rating-readonly .symbol-hover {
    scale: none;
  }

  :host([disabled]) {
    opacity: 0.5;
  }

  :host([disabled]) .symbols {
    cursor: not-allowed;
  }

  /* Forced colors mode */
  @media (forced-colors: active) {
    .symbol-active {
      color: SelectedItem;
    }
  }
`;var Et=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["change"],this.localize=new I(this),this.role="slider",this.hoverValue=0,this.isHovering=!1,this.name=null,this.label="",this.value=0,this.defaultValue=0,this.max=5,this.precision=1,this.readonly=!1,this.required=!1,this.getSymbol=(t,e)=>e?'<wa-icon name="star" library="system" variant="solid"></wa-icon>':'<wa-icon name="star" library="system" variant="regular"></wa-icon>',this.size="m",this.handleClick=t=>{this.disabled||(this.setRatingValue(this.getValueFromXCoordinate(t.clientX)),this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))},this.handleKeyDown=t=>{let e=this.matches(":dir(ltr)"),o=this.localize.dir()==="rtl",i=this.value;if(!(this.disabled||this.readonly)){if(t.key==="ArrowDown"||e&&t.key==="ArrowLeft"||o&&t.key==="ArrowRight"){let r=t.shiftKey?1:this.precision;this.value=Math.max(0,this.value-r),t.preventDefault()}if(t.key==="ArrowUp"||e&&t.key==="ArrowRight"||o&&t.key==="ArrowLeft"){let r=t.shiftKey?1:this.precision;this.value=Math.min(this.max,this.value+r),t.preventDefault()}t.key==="Home"&&(this.value=0,t.preventDefault()),t.key==="End"&&(this.value=this.max,t.preventDefault()),this.value!==i&&this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}},this.handlePointerEnter=t=>{this.isHovering=!0,this.hoverValue=this.getValueFromPointerPosition(t)},this.handlePointerMove=t=>{this.hoverValue=this.getValueFromPointerPosition(t)},this.handlePointerLeave=()=>{this.isHovering=!1},this.handlePointerDown=t=>{t.button===0&&(this.isHovering=!0,this.hoverValue=this.getValueFromPointerPosition(t),this.setPointerCapture(t.pointerId),t.preventDefault())},this.handlePointerUp=t=>{this.releasePointerCapture(t.pointerId),this.isHovering=!1}}static get validators(){return[...super.validators,oe()]}connectedCallback(){super.connectedCallback(),this.setAttribute("aria-valuenow",String(this.value)),this.setAttribute("aria-valuemin","0"),this.setAttribute("aria-valuemax",String(this.max)),this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.setAttribute("aria-readonly",this.readonly?"true":"false"),this.label&&this.setAttribute("aria-label",this.label),!this.disabled&&!this.readonly?this.tabIndex=0:this.tabIndex=-1,this.addEventListener("click",this.handleClick),this.addEventListener("keydown",this.handleKeyDown),this.addEventListener("pointerenter",this.handlePointerEnter),this.addEventListener("pointermove",this.handlePointerMove),this.addEventListener("pointerleave",this.handlePointerLeave),this.addEventListener("pointerdown",this.handlePointerDown),this.addEventListener("pointerup",this.handlePointerUp)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.handleClick),this.removeEventListener("keydown",this.handleKeyDown),this.removeEventListener("pointerenter",this.handlePointerEnter),this.removeEventListener("pointermove",this.handlePointerMove),this.removeEventListener("pointerleave",this.handlePointerLeave),this.removeEventListener("pointerdown",this.handlePointerDown),this.removeEventListener("pointerup",this.handlePointerUp)}updated(t){super.updated(t),t.has("value")&&this.setAttribute("aria-valuenow",String(this.value)),t.has("max")&&this.setAttribute("aria-valuemax",String(this.max)),t.has("disabled")&&(this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.tabIndex=this.disabled||this.readonly?-1:0),t.has("readonly")&&(this.setAttribute("aria-readonly",this.readonly?"true":"false"),this.tabIndex=this.disabled||this.readonly?-1:0),t.has("label")&&(this.label?this.setAttribute("aria-label",this.label):this.removeAttribute("aria-label"))}handleSizeChange(){U(this.localName,this.size)}getValueFromPointerPosition(t){return this.getValueFromXCoordinate(t.clientX)}getValueFromXCoordinate(t){let e=this.localize.dir()==="rtl",{left:o,right:i,width:r}=this.getBoundingClientRect(),s=e?this.roundToPrecision((i-t)/r*this.max,this.precision):this.roundToPrecision((t-o)/r*this.max,this.precision);return W(s,0,this.max)}setRatingValue(t){this.disabled||this.readonly||(this.value=t===this.value?0:t,this.isHovering=!1)}roundToPrecision(t,e=.5){let o=1/e;return Math.ceil(t*o)/o}handleHoverValueChange(){this.dispatchEvent(new Xa({phase:"move",value:this.hoverValue}))}handleIsHoveringChange(){this.dispatchEvent(new Xa({phase:this.isHovering?"start":"end",value:this.hoverValue}))}formResetCallback(){this.value=this.defaultValue,super.formResetCallback()}render(){let t=this.didSSR&&!this.hasUpdated?this.dir:this.localize.dir()==="rtl",e=Array.from(Array(this.max).keys()),o=0;return this.disabled||this.readonly?o=this.value:o=this.isHovering?this.hoverValue:this.value,p`
      <div
        part="base rating"
        class=${_({rating:!0,"rating-readonly":this.readonly,"rating-disabled":this.disabled})}
      >
        <span class="symbols">
          ${e.map(i=>{let r=o>=i+1;return o>i&&o<i+1?p`
                <span
                  class=${_({symbol:!0,"partial-symbol-container":!0,"symbol-hover":this.isHovering&&Math.ceil(o)===i+1})}
                  role="presentation"
                >
                  <div
                    style=${ct({clipPath:t?`inset(0 ${(o-i)*100}% 0 0)`:`inset(0 0 0 ${(o-i)*100}%)`})}
                  >
                    ${wo(this.getSymbol(i+1,!1))}
                  </div>
                  <div
                    class="partial-filled"
                    style=${ct({clipPath:t?`inset(0 0 0 ${100-(o-i)*100}%)`:`inset(0 ${100-(o-i)*100}% 0 0)`})}
                  >
                    ${wo(this.getSymbol(i+1,!0))}
                  </div>
                </span>
              `:p`
              <span
                class=${_({symbol:!0,"symbol-hover":this.isHovering&&Math.ceil(o)===i+1,"symbol-active":o>=i+1})}
                role="presentation"
              >
                ${wo(this.getSymbol(i+1,r))}
              </span>
            `})}
        </span>
      </div>
    `}};Et.css=[j,Cc];a([l({reflect:!0})],Et.prototype,"role",2);a([A()],Et.prototype,"hoverValue",2);a([A()],Et.prototype,"isHovering",2);a([l()],Et.prototype,"name",2);a([l()],Et.prototype,"label",2);a([l({type:Number})],Et.prototype,"value",2);a([l({type:Number,attribute:"default-value"})],Et.prototype,"defaultValue",2);a([l({type:Number})],Et.prototype,"max",2);a([l({type:Number})],Et.prototype,"precision",2);a([l({type:Boolean,reflect:!0})],Et.prototype,"readonly",2);a([l({type:Boolean})],Et.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],Et.prototype,"required",2);a([l()],Et.prototype,"getSymbol",2);a([l({reflect:!0})],Et.prototype,"size",2);a([y("size")],Et.prototype,"handleSizeChange",1);a([y("hoverValue")],Et.prototype,"handleHoverValueChange",1);a([y("isHovering")],Et.prototype,"handleIsHoveringChange",1);Et=a([k("wa-rating")],Et);var im=[{max:276e4,value:6e4,unit:"minute"},{max:72e6,value:36e5,unit:"hour"},{max:5184e5,value:864e5,unit:"day"},{max:24192e5,value:6048e5,unit:"week"},{max:28512e6,value:2592e6,unit:"month"},{max:1/0,value:31536e6,unit:"year"}],We=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.isoTime="",this.relativeTime="",this.date=new Date,this.format="long",this.numeric="auto",this.sync=!1,this.referenceDate=null}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.updateTimeout)}willUpdate(t){let e=this.referenceDate||new Date,o=new Date(this.date);if(isNaN(o.getMilliseconds()))return this.relativeTime="",this.isoTime="",super.willUpdate(t);let i=o.getTime()-e.getTime(),{unit:r,value:s}=im.find(n=>Math.abs(i)<n.max);if(this.isoTime=o.toISOString(),this.relativeTime=this.localize.relativeTime(Math.round(i/s),r,{numeric:this.numeric,style:this.format}),clearTimeout(this.updateTimeout),this.sync){let n;r==="minute"?n=Ir("second"):r==="hour"?n=Ir("minute"):r==="day"?n=Ir("hour"):n=Ir("day"),this.updateTimeout=setTimeout(()=>this.requestUpdate(),n)}}render(){return this.relativeTime===""&&this.isoTime===""?"":p`<time datetime=${this.isoTime}>${this.relativeTime}</time>`}};a([A()],We.prototype,"isoTime",2);a([A()],We.prototype,"relativeTime",2);a([l()],We.prototype,"date",2);a([l()],We.prototype,"format",2);a([l()],We.prototype,"numeric",2);a([l({type:Boolean})],We.prototype,"sync",2);a([A()],We.prototype,"referenceDate",2);We=a([k("wa-relative-time")],We);function Ir(t){let o={second:1e3,minute:6e4,hour:36e5,day:864e5}[t];return o-Date.now()%o}var kc=class extends Event{constructor(t){super("wa-resize",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Sc=C`
  :host {
    display: contents;
  }
`;var ii=class extends E{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(t=>{this.dispatchEvent(new kc({entries:t}))}),this.disabled||this.updateComplete.then(()=>{this.startObserver()})}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){let t=this.shadowRoot.querySelector("slot");if(t!==null){let e=t.assignedElements({flatten:!0});this.observedElements.forEach(o=>this.resizeObserver.unobserve(o)),this.observedElements=[],e.forEach(o=>{this.resizeObserver.observe(o),this.observedElements.push(o)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return p` <slot @slotchange=${this.handleSlotChange}></slot> `}};ii.css=Sc;a([l({type:Boolean,reflect:!0})],ii.prototype,"disabled",2);a([y("disabled",{waitUntilFirstUpdate:!0})],ii.prototype,"handleDisabledChange",1);ii=a([k("wa-resize-observer")],ii);var zc=C`
  :host {
    --shadow-color: var(--wa-color-surface-default);
    --shadow-size: 2rem;

    /* private (defined dynamically) */
    --start-shadow-opacity: 0;
    --end-shadow-opacity: 0;

    display: block;
    position: relative;
    max-width: 100%;
    overflow: hidden;
    isolation: isolate;
  }

  :host([orientation='vertical']) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  #content {
    z-index: 1; /* below shadows */
    border-radius: inherit;
    scroll-behavior: smooth;
    scrollbar-width: thin;

    /* Prevent text in mobile Safari from being larger when the container width larger than the viewport */
    -webkit-text-size-adjust: 100%;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: var(--wa-focus-ring-offset);
    }
  }

  :host([without-scrollbar]) #content {
    scrollbar-width: none;
  }

  :host([orientation='horizontal']) #content {
    overflow-x: auto;
    overflow-y: hidden;
  }

  :host([orientation='vertical']) #content {
    flex: 1 1 auto;
    min-height: 0; /* This is crucial for flex children to respect overflow */
    overflow-x: hidden;
    overflow-y: auto;
  }

  #start-shadow,
  #end-shadow {
    z-index: 2;
  }

  #start-shadow {
    opacity: var(--start-shadow-opacity);
  }

  #end-shadow {
    opacity: var(--end-shadow-opacity);
  }

  /* Horizontal shadows */
  :host([orientation='horizontal']) {
    #start-shadow,
    #end-shadow {
      position: absolute;
      top: 0;
      bottom: 0;
      width: var(--shadow-size);
      pointer-events: none;
    }

    #start-shadow {
      &:dir(ltr) {
        left: 0;
        background: linear-gradient(to right, var(--shadow-color), transparent 100%);
      }

      &:dir(rtl) {
        right: 0;
        background: linear-gradient(to left, var(--shadow-color), transparent 100%);
      }
    }

    #end-shadow {
      &:dir(ltr) {
        right: 0;
        background: linear-gradient(to left, var(--shadow-color), transparent 100%);
      }

      &:dir(rtl) {
        left: 0;
        background: linear-gradient(to right, var(--shadow-color), transparent 100%);
      }
    }
  }

  /* Vertical shadows */
  :host([orientation='vertical']) {
    #start-shadow,
    #end-shadow {
      position: absolute;
      right: 0;
      left: 0;
      height: var(--shadow-size);
      pointer-events: none;
    }

    #start-shadow {
      top: 0;
      background: linear-gradient(to bottom, var(--shadow-color), transparent 100%);
    }

    #end-shadow {
      bottom: 0;
      background: linear-gradient(to top, var(--shadow-color), transparent 100%);
    }
  }
`;var Ne=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.resizeObserver=null,this.canScroll=!1,this.orientation="horizontal",this.withoutScrollbar=!1,this.withoutShadow=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>this.updateScroll()),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect()}handleKeyDown(t){t.key==="Home"&&(t.preventDefault(),this.content.scrollTo({left:this.orientation==="horizontal"?0:void 0,top:this.orientation==="vertical"?0:void 0})),t.key==="End"&&(t.preventDefault(),this.content.scrollTo({left:this.orientation==="horizontal"?this.content.scrollWidth:void 0,top:this.orientation==="vertical"?this.content.scrollHeight:void 0}))}handleSlotChange(){this.updateScroll()}updateScroll(){if(this.orientation==="horizontal"){let t=Math.ceil(this.content.clientWidth),e=Math.abs(Math.ceil(this.content.scrollLeft)),i=Math.ceil(this.content.scrollWidth)-t;this.canScroll=i>0;let r=Math.min(1,e/(i*.05)),s=Math.min(1,(i-e)/(i*.05));this.style.setProperty("--start-shadow-opacity",String(r||0)),this.style.setProperty("--end-shadow-opacity",String(s||0))}else{let t=Math.ceil(this.content.clientHeight),e=Math.abs(Math.ceil(this.content.scrollTop)),i=Math.ceil(this.content.scrollHeight)-t;this.canScroll=i>0;let r=Math.min(1,e/(i*.05)),s=Math.min(1,(i-e)/(i*.05));this.style.setProperty("--start-shadow-opacity",String(r||0)),this.style.setProperty("--end-shadow-opacity",String(s||0))}}render(){return p`
      ${this.withoutShadow?"":p`
            <div id="start-shadow" part="start-shadow" aria-hidden="true"></div>
            <div id="end-shadow" part="end-shadow" aria-hidden="true"></div>
          `}

      <div
        id="content"
        part="content"
        role="region"
        aria-label=${this.localize.term("scrollableRegion")}
        tabindex=${this.canScroll?"0":"-1"}
        @keydown=${this.handleKeyDown}
        @scroll=${this.updateScroll}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `}};Ne.css=[zc];a([S("#content")],Ne.prototype,"content",2);a([A()],Ne.prototype,"canScroll",2);a([l({reflect:!0})],Ne.prototype,"orientation",2);a([l({attribute:"without-scrollbar",type:Boolean,reflect:!0})],Ne.prototype,"withoutScrollbar",2);a([l({attribute:"without-shadow",type:Boolean,reflect:!0})],Ne.prototype,"withoutShadow",2);a([No({passive:!0})],Ne.prototype,"updateScroll",1);Ne=a([k("wa-scroller")],Ne);var Ec=C`
  :host {
    --tag-max-size: 10ch;
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);
  }

  /* Add ellipses to multi select options */
  :host wa-tag::part(content) {
    display: initial;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: var(--tag-max-size);
  }

  :host .disabled [part~='combobox'] {
    opacity: 0.5;
    cursor: not-allowed;
    outline: none;
  }

  :host .enabled:is(.open, :focus-within) [part~='combobox'] {
    outline-color: var(--wa-color-focus);
  }

  /** The popup */
  .select {
    flex: 1 1 auto;
    display: inline-flex;
    width: 100%;
    position: relative;
    vertical-align: middle;

    /* Pass through from select to the popup */
    --show-duration: inherit;
    --hide-duration: inherit;

    &::part(popup) {
      z-index: 900;
    }

    &[data-current-placement^='top']::part(popup) {
      transform-origin: bottom;
    }

    &[data-current-placement^='bottom']::part(popup) {
      transform-origin: top;
    }
  }

  /* Combobox */
  .combobox {
    flex: 1;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: start;

    min-height: var(--wa-form-control-height);

    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    color: var(--wa-form-control-value-color);
    cursor: pointer;
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    overflow: hidden;
    padding: 0 var(--wa-form-control-padding-inline);
    position: relative;
    vertical-align: middle;
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);

    /* Pills */
    :host([pill]) & {
      border-radius: var(--wa-border-radius-pill);
    }
  }

  /* Appearance modifiers */
  :host([appearance='outlined']) .combobox {
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
  }

  :host([appearance='filled']) .combobox {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-neutral-fill-quiet);
  }

  :host([appearance='filled-outlined']) .combobox {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-form-control-border-color);
  }

  .display-input {
    position: relative;
    width: 100%;
    font: inherit;
    border: none;
    background: none;
    line-height: var(--wa-form-control-value-line-height);
    color: var(--wa-form-control-value-color);
    cursor: inherit;
    overflow: hidden;
    padding: 0;
    margin: 0;
    -webkit-appearance: none;

    &:focus {
      outline: none;
    }

    &::placeholder {
      color: var(--wa-form-control-placeholder-color);
    }
  }

  /* Manage spacing when tags are present */
  :host([multiple]) {
    --_padding-with-tags: calc(var(--wa-form-control-height) * 0.1 - var(--wa-form-control-border-width));

    & .combobox:has(.tags wa-tag) {
      padding-block: var(--_padding-with-tags);
      padding-inline-start: var(--_padding-with-tags);
    }
  }

  /* Visually hide the display input when multiple is enabled */
  :host([multiple]) .combobox:has(.tags wa-tag) .display-input {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .value-input {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    padding: 0;
    margin: 0;
  }

  .tags {
    display: flex;
    flex: 1;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25em;

    &::slotted(wa-tag) {
      cursor: pointer !important;
    }

    .disabled &,
    .disabled &::slotted(wa-tag) {
      cursor: not-allowed !important;
    }
  }

  /* Start and End */

  .start,
  .end {
    flex: 0;
    display: inline-flex;
    align-items: center;
    color: var(--wa-color-neutral-on-quiet);
  }

  .end::slotted(*) {
    margin-inline-start: var(--wa-form-control-padding-inline);
  }

  .start::slotted(*) {
    margin-inline-end: var(--wa-form-control-padding-inline);
  }

  :host([multiple]) .combobox:has(.tags wa-tag) .start::slotted(*) {
    margin-inline-start: calc(var(--wa-form-control-padding-inline) - var(--_padding-with-tags));
  }

  /* Clear button */
  [part~='clear-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--wa-color-neutral-on-quiet);
    border: none;
    background: none;
    padding: 0;
    transition: color var(--wa-transition-normal);
    cursor: pointer;
    margin-inline-start: var(--wa-form-control-padding-inline);

    &:focus {
      outline: none;
    }

    @media (hover: hover) {
      &:hover {
        color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
      }
    }

    &:active {
      color: color-mix(in oklab, currentColor, var(--wa-color-mix-active));
    }
  }

  /* Expand icon */
  .expand-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    color: var(--wa-color-neutral-on-quiet);
    transition: rotate var(--wa-transition-slow) var(--wa-transition-easing);
    rotate: 0deg;
    margin-inline-start: var(--wa-form-control-padding-inline);

    .open & {
      rotate: -180deg;
    }
  }

  /* Listbox */
  .listbox {
    display: block;
    position: relative;
    font: inherit;
    box-shadow: var(--wa-shadow-m);
    background: var(--wa-color-surface-raised);
    border-color: var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    border-style: var(--wa-border-style);
    border-width: var(--wa-border-width-s);
    padding: 0.25em;
    overflow: auto;
    overscroll-behavior: none;

    /* Make sure it adheres to the popup's auto size */
    max-width: var(--auto-size-available-width);
    max-height: var(--auto-size-available-height);

    &::slotted(wa-divider) {
      --spacing: 0.5em;
    }
  }

  /* Space options with half the listbox's padding */
  .listbox slot:not([name]) {
    display: flex;
    flex-direction: column;
    gap: 0.125em;
  }

  slot:not([name])::slotted(small) {
    display: block;
    font-size: var(--wa-font-size-smaller);
    font-weight: var(--wa-font-weight-semibold);
    color: var(--wa-color-text-quiet);
    padding-block: 0.5em;
    padding-inline: 2.25em;
  }
`;var ot=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["blur","input"],this.cachedOptions=null,this.hasSlotController=new Z(this,"hint","label"),this.localize=new I(this),this.selectionOrder=new Map,this.typeToSelectString="",this.slotChangePending=!1,this.displayLabel="",this.selectedOptions=[],this.name="",this._defaultValue=null,this.size="m",this.placeholder="",this.multiple=!1,this.maxOptionsVisible=3,this.disabled=!1,this.withClear=!1,this.open=!1,this.appearance="outlined",this.pill=!1,this.label="",this.placement="bottom",this.hint="",this.withLabel=!1,this.withHint=!1,this.required=!1,this.getTag=t=>p`
        <wa-tag
          part="tag"
          exportparts="
            base:tag__base,
            content:tag__content,
            remove-button:tag__remove-button,
            remove-button__base:tag__remove-button__base
          "
          ?pill=${this.pill}
          size=${this.size}
          with-remove
          data-value=${t.value}
          @wa-remove=${e=>this.handleTagRemove(e,t)}
        >
          ${t.label}
        </wa-tag>
      `,this.handleDocumentFocusIn=t=>{let e=t.composedPath();this&&!e.includes(this)&&this.hide()},this.handleDocumentKeyDown=t=>{let e=t.target,o=e.closest('[part~="clear-button"]')!==null,i=e.closest("wa-button")!==null;if(!(o||i)){if(t.key==="Escape"&&this.open&&Dt(this)&&(t.preventDefault(),t.stopPropagation(),this.hide(),this.displayInput.focus({preventScroll:!0})),t.key==="Enter"||t.key===" "&&this.typeToSelectString===""){if(t.preventDefault(),t.stopImmediatePropagation(),!this.open){this.show();return}this.currentOption&&!this.currentOption.disabled&&(this.valueHasChanged=!0,this.hasInteracted=!0,this.multiple?this.toggleOptionSelection(this.currentOption):this.setSelectedOptions(this.currentOption),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})));return}if(["ArrowUp","ArrowDown","Home","End"].includes(t.key)){let r=this.getAllOptions(),s=r.indexOf(this.currentOption),n=Math.max(0,s);if(t.preventDefault(),!this.open&&(this.show(),this.currentOption))return;t.key==="ArrowDown"?(n=s+1,n>r.length-1&&(n=0)):t.key==="ArrowUp"?(n=s-1,n<0&&(n=r.length-1)):t.key==="Home"?n=0:t.key==="End"&&(n=r.length-1),this.setCurrentOption(r[n])}if(t.key?.length===1||t.key==="Backspace"){let r=this.getAllOptions();if(t.metaKey||t.ctrlKey||t.altKey)return;if(!this.open){if(t.key==="Backspace")return;this.show()}t.stopPropagation(),t.preventDefault(),clearTimeout(this.typeToSelectTimeout),this.typeToSelectTimeout=window.setTimeout(()=>this.typeToSelectString="",1e3),t.key==="Backspace"?this.typeToSelectString=this.typeToSelectString.slice(0,-1):this.typeToSelectString+=t.key.toLowerCase();for(let s of r)if(s.label.toLowerCase().startsWith(this.typeToSelectString)){this.setCurrentOption(s);break}}}},this.handleDocumentMouseDown=t=>{let e=t.composedPath();this&&!e.includes(this)&&this.hide()}}static get validators(){let t=[oe({validationElement:Object.assign(document.createElement("select"),{required:!0})})];return[...super.validators,...t]}get validationTarget(){return this.valueInput}set defaultValue(t){this._defaultValue=this.convertDefaultValue(t)}get defaultValue(){return this.convertDefaultValue(this._defaultValue)}rawValuesEqual(t,e){return t==null&&e==null?!0:t==null||e==null||t.length!==e.length?!1:t.every((o,i)=>o===e[i])}convertDefaultValue(t){return!(this.multiple||this.hasAttribute("multiple"))&&Array.isArray(t)&&(t=t[0]),t}set value(t){let e=this.value;t instanceof FormData&&(t=t.getAll(this.name)),t!=null&&!Array.isArray(t)&&(t=[t]);let o=this._value;this._value=t??null,this.rawValuesEqual(o,this._value)||(this.valueHasChanged=!0,this.requestUpdate("value",e))}get value(){let t=this._value??this.defaultValue??null;t!=null&&(t=Array.isArray(t)?t:[t]),this.optionValues=new Set(this.getAllOptions().filter(o=>!o.disabled).map(o=>o.value));let e=t;return t!=null&&(e=t.filter(o=>this.optionValues.has(o)),e=this.multiple?e:e[0],e=e??null),e}handleSizeChange(){U(this.localName,this.size)}connectedCallback(){super.connectedCallback(),this.processSlotChange(),this.open=!1}disconnectedCallback(){super.disconnectedCallback(),this.removeOpenListeners(),this.cachedOptions=null}updateDefaultValue(){let e=this.getAllOptions().filter(o=>o.hasAttribute("selected")||o.defaultSelected);if(e.length>0){let o=e.map(i=>i.value);this._defaultValue=this.multiple?o:o[0]}this.hasAttribute("value")&&(this._defaultValue=this.getAttribute("value")||null)}addOpenListeners(){document.addEventListener("focusin",this.handleDocumentFocusIn),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown),Kt(this),this.getRootNode()!==document&&this.getRootNode().addEventListener("focusin",this.handleDocumentFocusIn)}removeOpenListeners(){document.removeEventListener("focusin",this.handleDocumentFocusIn),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),It(this),this.getRootNode()!==document&&this.getRootNode().removeEventListener("focusin",this.handleDocumentFocusIn)}handleFocus(){this.displayInput.setSelectionRange(0,0)}handleLabelClick(){this.displayInput.focus()}handleComboboxClick(t){t.preventDefault()}handleComboboxMouseDown(t){let o=t.composedPath().some(i=>i instanceof Element&&i.tagName.toLowerCase()==="wa-button");this.disabled||o||(t.preventDefault(),this.displayInput.focus({preventScroll:!0}),this.open=!this.open)}handleComboboxKeyDown(t){t.stopPropagation(),this.handleDocumentKeyDown(t)}handleClearClick(t){t.stopPropagation(),this.hasInteracted=!0,this.valueHasChanged=!0,this.value!==null&&(this.displayLabel="",this.selectionOrder.clear(),this.setSelectedOptions([]),this.displayInput.focus({preventScroll:!0}),this.updateComplete.then(()=>{this.dispatchEvent(new co),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))}handleClearMouseDown(t){t.stopPropagation(),t.preventDefault()}handleOptionClick(t){let o=t.target.closest("wa-option");o&&!o.disabled&&(this.hasInteracted=!0,this.valueHasChanged=!0,this.multiple?this.toggleOptionSelection(o):this.setSelectedOptions(o),this.updateComplete.then(()=>this.displayInput.focus({preventScroll:!0})),this.requestUpdate("value"),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})))}handleDefaultSlotChange(){this.slotChangePending||(this.slotChangePending=!0,queueMicrotask(()=>{this.slotChangePending=!1,this.processSlotChange()}))}processSlotChange(){if(customElements.get("wa-option")||customElements.whenDefined("wa-option").then(()=>this.handleDefaultSlotChange()),this.didSSR&&!this.hasUpdated){this.updateComplete.then(()=>{this.handleDefaultSlotChange()});return}this.cachedOptions=null;let t=this.getAllOptions();this.updateDefaultValue();let e=this.value;if(e==null||!this.valueHasChanged&&!this.hasInteracted){this.selectionChanged();return}Array.isArray(e)||(e=[e]);let o=t.filter(i=>e.includes(i.value));this.setSelectedOptions(o)}handleTagRemove(t,e){if(t.stopPropagation(),this.disabled)return;this.hasInteracted=!0,this.valueHasChanged=!0;let o=e;if(!o){let i=t.target.closest("wa-tag[data-value]");if(i){let r=i.dataset.value;o=this.selectedOptions.find(s=>s.value===r)}}o&&(this.toggleOptionSelection(o,!1),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}))}getAllOptions(){return this.cachedOptions?this.cachedOptions:this?.querySelectorAll?(this.cachedOptions=[...this.querySelectorAll("wa-option")],this.cachedOptions):[]}getFirstOption(){return this.querySelector("wa-option")}setCurrentOption(t){this.getAllOptions().forEach(o=>{o.current=!1,o.tabIndex=-1}),t&&(this.currentOption=t,t.current=!0,t.tabIndex=0,t.focus({preventScroll:!0}),this.open&&!this.listbox.hidden&&go(t,this.listbox,"vertical","auto"))}setSelectedOptions(t){let e=this.getAllOptions(),o=Array.isArray(t)?t:[t];e.forEach(i=>{o.includes(i)||(i.selected=!1)}),o.length&&o.forEach(i=>i.selected=!0),this.selectionChanged()}toggleOptionSelection(t,e){e===!0||e===!1?t.selected=e:t.selected=!t.selected,this.selectionChanged()}selectionChanged(){let e=this.getAllOptions().filter(n=>{if(!this.hasInteracted&&!this.valueHasChanged){let c=this.defaultValue,h=Array.isArray(c)?c:[c];return n.hasAttribute("selected")||n.defaultSelected||n.selected||h?.includes(n.value)}return n.selected}),o=new Set(e.map(n=>n.value));for(let n of this.selectionOrder.keys())o.has(n)||this.selectionOrder.delete(n);let r=(this.selectionOrder.size>0?Math.max(...this.selectionOrder.values()):-1)+1;for(let n of e)this.selectionOrder.has(n.value)||this.selectionOrder.set(n.value,r++);this.selectedOptions=e.sort((n,c)=>{let h=this.selectionOrder.get(n.value)??0,d=this.selectionOrder.get(c.value)??0;return h-d});let s=new Set(this.selectedOptions.map(n=>n.value));if(s.size>0||this._value){let n=this._value;if(this._value==null){let c=this.defaultValue??[];this._value=Array.isArray(c)?c:[c]}this._value=this._value?.filter(c=>!this.optionValues?.has(c))??null,this._value?.unshift(...s),this.requestUpdate("value",n)}if(this.multiple)this.placeholder&&!this.value?.length?this.displayLabel="":this.displayLabel=this.localize.term("numOptionsSelected",this.selectedOptions.length);else{let n=this.selectedOptions[0];this.displayLabel=n?.label??""}this.updateComplete.then(()=>{this.updateValidity()})}get tags(){return this.selectedOptions.map((t,e)=>{if(e<this.maxOptionsVisible||this.maxOptionsVisible<=0){let o=this.getTag(t,e);return o?typeof o=="string"?wo(o):o:null}else if(e===this.maxOptionsVisible)return p`
          <wa-tag
            part="tag"
            exportparts="
              base:tag__base,
              content:tag__content,
              remove-button:tag__remove-button,
              remove-button__base:tag__remove-button__base
            "
            >+${this.selectedOptions.length-e}</wa-tag
          >
        `;return null})}updated(t){super.updated(t),(t.has("value")||t.has("displayLabel"))&&this.customStates.set("blank",!this.value&&!this.displayLabel)}handleDisabledChange(){this.disabled&&this.open&&(this.open=!1)}handleValueChange(){let t=this.getAllOptions(),e=Array.isArray(this.value)?this.value:[this.value],o=t.filter(i=>e.includes(i.value));this.setSelectedOptions(o),this.updateValidity()}async handleOpenChange(){if(this.open&&!this.disabled){this.setCurrentOption(this.selectedOptions[0]||this.getFirstOption());let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}this.addOpenListeners(),this.listbox.hidden=!1,this.popup.active=!0,requestAnimationFrame(()=>{this.setCurrentOption(this.currentOption)}),await G(this.popup.popup,"show"),this.currentOption&&go(this.currentOption,this.listbox,"vertical","auto"),this.dispatchEvent(new Vt)}else{let t=new Ft;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}this.removeOpenListeners(),await G(this.popup.popup,"hide"),this.listbox.hidden=!0,this.popup.active=!1,this.dispatchEvent(new qt)}}async show(){if(this.open||this.disabled){this.open=!1;return}return this.open=!0,Ct(this,"wa-after-show")}async hide(){if(!this.open||this.disabled){this.open=!1;return}return this.open=!1,Ct(this,"wa-after-hide")}focus(t){this.displayInput.focus(t)}blur(){this.displayInput.blur()}formResetCallback(){this.selectionOrder.clear(),this.value=this.defaultValue,super.formResetCallback(),this.handleValueChange(),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e,r=(this.hasUpdated||!1)&&this.withClear&&!this.disabled&&(this.displayLabel||this.value&&this.value.length>0);return p`
      <div
        part="form-control"
        class=${_({"form-control":!0,"form-control-has-label":o})}
      >
        <label
          id="label"
          part="form-control-label label"
          class=${_({label:!0,"has-label":o})}
          aria-hidden=${o?"false":"true"}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <wa-popup
            class=${_({select:!0,open:this.open,disabled:this.disabled,enabled:!this.disabled,multiple:this.multiple})}
            placement=${this.placement}
            flip
            shift
            sync="width"
            auto-size="vertical"
            auto-size-padding="10"
          >
            <div
              part="combobox"
              class="combobox"
              slot="anchor"
              @keydown=${this.handleComboboxKeyDown}
              @mousedown=${this.handleComboboxMouseDown}
              @click=${this.handleComboboxClick}
            >
              <slot part="start" name="start" class="start"></slot>

              <input
                part="display-input"
                class="display-input"
                type="text"
                placeholder=${this.placeholder}
                .disabled=${this.disabled}
                .value=${this.displayLabel}
                ?required=${this.required}
                autocomplete="off"
                spellcheck="false"
                autocapitalize="off"
                readonly
                aria-invalid=${!this.validity.valid}
                aria-controls="listbox"
                aria-expanded=${this.open?"true":"false"}
                aria-haspopup="listbox"
                aria-labelledby="label"
                aria-disabled=${this.disabled?"true":"false"}
                aria-describedby="hint"
                role="combobox"
                tabindex="0"
                @focus=${this.handleFocus}
              />

              <!-- Tags need to wait for first hydration before populating otherwise it will create a hydration mismatch. -->
              ${this.multiple&&this.hasUpdated?p`<div part="tags" class="tags" @wa-remove=${this.handleTagRemove}>${this.tags}</div>`:""}

              <input
                class="value-input"
                type="text"
                ?disabled=${this.disabled}
                ?required=${this.required}
                .value=${Array.isArray(this.value)?this.value.join(", "):this.value}
                tabindex="-1"
                aria-hidden="true"
                @focus=${()=>this.focus()}
              />

              ${r?p`
                    <button
                      part="clear-button"
                      type="button"
                      aria-label=${this.localize.term("clearEntry")}
                      @mousedown=${this.handleClearMouseDown}
                      @click=${this.handleClearClick}
                      tabindex="-1"
                    >
                      <slot name="clear-icon">
                        <wa-icon name="circle-xmark" library="system" variant="regular"></wa-icon>
                      </slot>
                    </button>
                  `:""}

              <slot name="end" part="end" class="end"></slot>

              <slot name="expand-icon" part="expand-icon" class="expand-icon">
                <wa-icon library="system" name="chevron-down" variant="solid"></wa-icon>
              </slot>
            </div>

            <div
              id="listbox"
              role="listbox"
              aria-expanded=${this.open?"true":"false"}
              aria-multiselectable=${this.multiple?"true":"false"}
              aria-labelledby="label"
              part="listbox"
              class="listbox"
              tabindex="-1"
              @mouseup=${this.handleOptionClick}
            >
              <slot @slotchange=${this.handleDefaultSlotChange}></slot>
            </div>
          </wa-popup>
        </div>

        <slot
          id="hint"
          name="hint"
          part="hint"
          class=${_({"has-slotted":i})}
          aria-hidden=${i?"false":"true"}
          >${this.hint}</slot
        >
      </div>
    `}};ot.css=[Ec,pt,j];a([S(".select")],ot.prototype,"popup",2);a([S(".combobox")],ot.prototype,"combobox",2);a([S(".display-input")],ot.prototype,"displayInput",2);a([S(".value-input")],ot.prototype,"valueInput",2);a([S(".listbox")],ot.prototype,"listbox",2);a([A()],ot.prototype,"displayLabel",2);a([A()],ot.prototype,"currentOption",2);a([A()],ot.prototype,"selectedOptions",2);a([l({reflect:!0})],ot.prototype,"name",2);a([l({attribute:!1})],ot.prototype,"defaultValue",1);a([l({attribute:"value",reflect:!1})],ot.prototype,"value",1);a([l({reflect:!0})],ot.prototype,"size",2);a([y("size")],ot.prototype,"handleSizeChange",1);a([l()],ot.prototype,"placeholder",2);a([l({type:Boolean,reflect:!0})],ot.prototype,"multiple",2);a([l({attribute:"max-options-visible",type:Number})],ot.prototype,"maxOptionsVisible",2);a([l({type:Boolean})],ot.prototype,"disabled",2);a([l({attribute:"with-clear",type:Boolean})],ot.prototype,"withClear",2);a([l({type:Boolean,reflect:!0})],ot.prototype,"open",2);a([l({reflect:!0})],ot.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],ot.prototype,"pill",2);a([l()],ot.prototype,"label",2);a([l({reflect:!0})],ot.prototype,"placement",2);a([l({attribute:"hint"})],ot.prototype,"hint",2);a([l({attribute:"with-label",type:Boolean})],ot.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],ot.prototype,"withHint",2);a([l({type:Boolean,reflect:!0})],ot.prototype,"required",2);a([l({attribute:!1})],ot.prototype,"getTag",2);a([y("disabled",{waitUntilFirstUpdate:!0})],ot.prototype,"handleDisabledChange",1);a([y("value",{waitUntilFirstUpdate:!0})],ot.prototype,"handleValueChange",1);a([y("open",{waitUntilFirstUpdate:!0})],ot.prototype,"handleOpenChange",1);ot=a([k("wa-select")],ot);ot.disableWarning?.("change-in-update");var Lc=class extends Event{constructor(){super("wa-remove",{bubbles:!0,cancelable:!1,composed:!0})}};var $c=C`
  @layer wa-component {
    :host {
      display: inline-flex;
      gap: 0.5em;
      border-radius: var(--wa-border-radius-m);
      align-items: center;
      background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      border-color: var(--wa-color-border-normal, var(--wa-color-neutral-border-normal));
      border-style: var(--wa-border-style);
      border-width: var(--wa-border-width-s);
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      font-size: inherit;
      line-height: 1;
      white-space: nowrap;
      user-select: none;
      -webkit-user-select: none;
      height: calc(var(--wa-form-control-height) * 0.8);
      line-height: calc(var(--wa-form-control-height) - var(--wa-form-control-border-width) * 2);
      padding: 0 0.75em;
    }

    /* Appearance modifiers */
    :host([appearance='outlined']) {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: transparent;
      border-color: var(--wa-color-border-loud, var(--wa-color-neutral-border-loud));
    }

    :host([appearance='filled']) {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      border-color: transparent;
    }

    :host([appearance='filled-outlined']) {
      color: var(--wa-color-on-quiet, var(--wa-color-neutral-on-quiet));
      background-color: var(--wa-color-fill-quiet, var(--wa-color-neutral-fill-quiet));
      border-color: var(--wa-color-border-normal, var(--wa-color-neutral-border-normal));
    }

    :host([appearance='accent']) {
      color: var(--wa-color-on-loud, var(--wa-color-neutral-on-loud));
      background-color: var(--wa-color-fill-loud, var(--wa-color-neutral-fill-loud));
      border-color: transparent;
    }
  }

  .content {
    font-size: var(--wa-font-size-smaller);
  }

  [part='remove-button'] {
    line-height: 1;
  }

  [part='remove-button']::part(base) {
    padding: 0;
    height: 1em;
    width: 1em;
    color: currentColor;
  }

  @media (hover: hover) {
    :host(:hover) > [part='remove-button']::part(base) {
      background-color: transparent;
      color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
    }
  }

  :host(:active) > [part='remove-button']::part(base) {
    background-color: transparent;
    color: color-mix(in oklab, currentColor, var(--wa-color-mix-active));
  }

  /*
   * Pill modifier
   */
  :host([pill]) {
    border-radius: var(--wa-border-radius-pill);
  }
`;var He=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.variant="neutral",this.appearance="filled-outlined",this.size="m",this.pill=!1,this.withRemove=!1}handleSizeChange(){U(this.localName,this.size)}handleRemoveClick(){this.dispatchEvent(new Lc)}render(){return p`
      <slot part="content" class="content"></slot>

      ${this.withRemove?p`
            <wa-button
              part="remove-button"
              exportparts="base:remove-button__base"
              class="remove"
              appearance="plain"
              size=${this.size}
              @click=${this.handleRemoveClick}
              tabindex="-1"
            >
              <wa-icon name="xmark" library="system" variant="solid" label=${this.localize.term("remove")}></wa-icon>
            </wa-button>
          `:""}
    `}};He.css=[$c,De,j];a([l({reflect:!0})],He.prototype,"variant",2);a([l({reflect:!0})],He.prototype,"appearance",2);a([l({reflect:!0})],He.prototype,"size",2);a([y("size")],He.prototype,"handleSizeChange",1);a([l({type:Boolean,reflect:!0})],He.prototype,"pill",2);a([l({attribute:"with-remove",type:Boolean})],He.prototype,"withRemove",2);He=a([k("wa-tag")],He);var Ac=C`
  :host {
    --color: var(--wa-color-neutral-fill-normal);
    --sheen-color: color-mix(in oklab, var(--color), var(--wa-color-surface-raised));

    display: flex;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 1rem;
  }

  .indicator {
    flex: 1 1 auto;
    background: var(--color);
    border-radius: var(--wa-border-radius-pill);
  }

  :host([effect='sheen']) .indicator {
    background: linear-gradient(270deg, var(--sheen-color), var(--color), var(--color), var(--sheen-color));
    background-size: 400% 100%;
    animation: sheen 8s ease-in-out infinite;
  }

  :host([effect='pulse']) .indicator {
    animation: pulse 2s ease-in-out 0.5s infinite;
  }

  /* Forced colors mode */
  @media (forced-colors: active) {
    :host {
      --color: GrayText;
    }
  }

  @keyframes sheen {
    0% {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
`;var Pi=class extends E{constructor(){super(...arguments),this.effect="none"}render(){return p` <div part="indicator" class="indicator"></div> `}};Pi.css=Ac;a([l({reflect:!0})],Pi.prototype,"effect",2);Pi=a([k("wa-skeleton")],Pi);var _c=C`
  :host {
    --track-size: 0.5em;
    --thumb-width: 1.4em;
    --thumb-height: 1.4em;
    --marker-width: 0.1875em;
    --marker-height: 0.1875em;
  }

  :host([orientation='vertical']) {
    width: auto;
  }

  #label:has(~ .vertical) {
    display: block;
    order: 2;
    max-width: none;
    text-align: center;
  }

  #description:has(~ .vertical) {
    order: 3;
    text-align: center;
  }

  /* Add extra space between slider and label, when present */
  #label.has-label ~ #slider {
    &.horizontal {
      margin-block-start: 0.5em;
    }
    &.vertical {
      margin-block-end: 0.5em;
    }
  }

  #slider {
    touch-action: none;

    &:focus {
      outline: none;
    }

    &:focus-visible:not(.disabled) #thumb,
    &:focus-visible:not(.disabled) #thumb-min,
    &:focus-visible:not(.disabled) #thumb-max {
      outline: var(--wa-focus-ring);
      /* intentionally no offset due to border */
    }
  }

  #track {
    position: relative;
    border-radius: 9999px;
    background: var(--wa-color-neutral-fill-normal);
    isolation: isolate;
  }

  /* Orientation */
  .horizontal #track {
    height: var(--track-size);
  }

  .vertical #track {
    order: 1;
    width: var(--track-size);
    height: 200px;
  }

  /* Disabled */
  .disabled #track {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Indicator */
  #indicator {
    position: absolute;
    border-radius: inherit;
    background-color: var(--wa-form-control-activated-color);

    &:dir(ltr) {
      right: calc(100% - max(var(--start), var(--end)));
      left: min(var(--start), var(--end));
    }

    &:dir(rtl) {
      right: min(var(--start), var(--end));
      left: calc(100% - max(var(--start), var(--end)));
    }
  }

  .horizontal #indicator {
    top: 0;
    height: 100%;
  }

  .vertical #indicator {
    top: calc(100% - var(--end));
    bottom: var(--start);
    left: 0;
    width: 100%;
  }

  /* Thumbs */
  #thumb,
  #thumb-min,
  #thumb-max {
    z-index: 3;
    position: absolute;
    width: var(--thumb-width);
    height: var(--thumb-height);
    border: solid 0.125em var(--wa-color-surface-default);
    border-radius: 50%;
    background-color: var(--wa-form-control-activated-color);
    cursor: pointer;
  }

  .disabled #thumb,
  .disabled #thumb-min,
  .disabled #thumb-max {
    cursor: inherit;
  }

  .horizontal #thumb,
  .horizontal #thumb-min,
  .horizontal #thumb-max {
    top: calc(50% - var(--thumb-height) / 2);

    &:dir(ltr) {
      right: auto;
      left: calc(var(--position) - var(--thumb-width) / 2);
    }

    &:dir(rtl) {
      right: calc(var(--position) - var(--thumb-width) / 2);
      left: auto;
    }
  }

  .vertical #thumb,
  .vertical #thumb-min,
  .vertical #thumb-max {
    bottom: calc(var(--position) - var(--thumb-height) / 2);
    left: calc(50% - var(--thumb-width) / 2);
  }

  /* Range-specific thumb styles */
  :host([range]) {
    #thumb-min:focus-visible,
    #thumb-max:focus-visible {
      z-index: 4; /* Ensure focused thumb appears on top */
      outline: var(--wa-focus-ring);
      /* intentionally no offset due to border */
    }
  }

  /* Markers */
  #markers {
    pointer-events: none;
  }

  .marker {
    z-index: 2;
    position: absolute;
    width: var(--marker-width);
    height: var(--marker-height);
    border-radius: 50%;
    background-color: var(--wa-color-surface-default);
  }

  .marker:first-of-type,
  .marker:last-of-type {
    display: none;
  }

  .horizontal .marker {
    top: calc(50% - var(--marker-height) / 2);
    left: calc(var(--position) - var(--marker-width) / 2);
  }

  .vertical .marker {
    top: calc(var(--position) - var(--marker-height) / 2);
    left: calc(50% - var(--marker-width) / 2);
  }

  /* Marker labels */
  #references {
    position: relative;

    slot {
      display: flex;
      justify-content: space-between;
      height: 100%;
    }

    ::slotted(*) {
      color: var(--wa-color-text-quiet);
      font-size: 0.875em;
      line-height: 1;
    }
  }

  .horizontal {
    #references {
      margin-block-start: 0.5em;
    }
  }

  .vertical {
    display: flex;
    margin-inline: auto;

    #track {
      order: 1;
    }

    #references {
      order: 2;
      width: min-content;
      margin-inline-start: 0.75em;

      slot {
        flex-direction: column;
      }
    }
  }

  .vertical #references slot {
    flex-direction: column;
  }
`;function Ya(t,e,o){let i=(t-e)/o;return Math.abs(i-Math.round(i))>1e-9}var rm=()=>({observedAttributes:["min","max","step"],checkValidity(t){let e={message:"",isValid:!0,invalidKeys:[]},o=(i,r,s,n)=>{if(typeof document>"u")return"";let c=document.createElement("input");return c.type="range",c.min=String(r),c.max=String(s),c.step=String(n),c.value=String(i),c.checkValidity(),c.validationMessage};if(t.isRange){let i=t.minValue,r=t.maxValue;if(i<t.min)return e.isValid=!1,e.invalidKeys.push("rangeUnderflow"),e.message=o(i,t.min,t.max,t.step)||`Value must be greater than or equal to ${t.min}.`,e;if(r>t.max)return e.isValid=!1,e.invalidKeys.push("rangeOverflow"),e.message=o(r,t.min,t.max,t.step)||`Value must be less than or equal to ${t.max}.`,e;if(t.step&&t.step!==1){let s=Ya(i,t.min,t.step),n=Ya(r,t.min,t.step);if(s||n){e.isValid=!1,e.invalidKeys.push("stepMismatch");let c=s?i:r;return e.message=o(c,t.min,t.max,t.step)||`Value must be a multiple of ${t.step}.`,e}}}else{let i=t.value;if(i<t.min)return e.isValid=!1,e.invalidKeys.push("rangeUnderflow"),e.message=o(i,t.min,t.max,t.step)||`Value must be greater than or equal to ${t.min}.`,e;if(i>t.max)return e.isValid=!1,e.invalidKeys.push("rangeOverflow"),e.message=o(i,t.min,t.max,t.step)||`Value must be less than or equal to ${t.max}.`,e;if(t.step&&t.step!==1&&Ya(i,t.min,t.step))return e.isValid=!1,e.invalidKeys.push("stepMismatch"),e.message=o(i,t.min,t.max,t.step)||`Value must be a multiple of ${t.step}.`,e}return e}}),tt=class extends q{constructor(){super(...arguments),this.draggableThumbMin=null,this.draggableThumbMax=null,this.hasSlotController=new Z(this,"hint","label"),this.localize=new I(this),this.activeThumb=null,this.lastTrackPosition=null,this.label="",this.hint="",this.minValue=0,this.maxValue=50,this.defaultValue=this.getAttribute("value")==null?this.minValue:Number(this.getAttribute("value")),this._value=null,this.range=!1,this.disabled=!1,this.readonly=!1,this.orientation="horizontal",this.size="m",this.min=0,this.max=100,this.step=1,this.tooltipDistance=8,this.tooltipPlacement="top",this.withMarkers=!1,this.withTooltip=!1,this.withLabel=!1,this.withHint=!1}static get validators(){return[...super.validators,rm()]}get focusableAnchor(){return this.isRange?this.thumbMin||this.slider:this.slider}get validationTarget(){return this.focusableAnchor}get value(){if(this.valueHasChanged){let e=this._value??this.minValue??0;return W(e,this.min,this.max)}let t=this._value??this.defaultValue;return W(t,this.min,this.max)}set value(t){t=Number(t)??this.minValue,this._value!==t&&(this.valueHasChanged=!0,this._value=t)}get isRange(){return this.range}handleSizeChange(){U(this.localName,this.size)}firstUpdated(){this.isRange?(this.draggableThumbMin=new fi(this.thumbMin,{start:()=>{this.activeThumb="min",this.trackBoundingClientRect=this.track.getBoundingClientRect(),this.valueWhenDraggingStarted=this.minValue,this.customStates.set("dragging",!0),this.showRangeTooltips()},move:(t,e)=>{this.setThumbValueFromCoordinates(t,e,"min")},stop:()=>{this.minValue!==this.valueWhenDraggingStarted&&(this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.hasInteracted=!0),this.hideRangeTooltips(),this.customStates.set("dragging",!1),this.valueWhenDraggingStarted=void 0,this.activeThumb=null}}),this.draggableThumbMax=new fi(this.thumbMax,{start:()=>{this.activeThumb="max",this.trackBoundingClientRect=this.track.getBoundingClientRect(),this.valueWhenDraggingStarted=this.maxValue,this.customStates.set("dragging",!0),this.showRangeTooltips()},move:(t,e)=>{this.setThumbValueFromCoordinates(t,e,"max")},stop:()=>{this.maxValue!==this.valueWhenDraggingStarted&&(this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.hasInteracted=!0),this.hideRangeTooltips(),this.customStates.set("dragging",!1),this.valueWhenDraggingStarted=void 0,this.activeThumb=null}}),this.draggableTrack=new fi(this.track,{start:(t,e)=>{if(this.trackBoundingClientRect=this.track.getBoundingClientRect(),this.activeThumb)this.valueWhenDraggingStarted=this.activeThumb==="min"?this.minValue:this.maxValue;else{let o=this.getValueFromCoordinates(t,e),i=Math.abs(o-this.minValue),r=Math.abs(o-this.maxValue);if(i===r)if(o>this.maxValue)this.activeThumb="max";else if(o<this.minValue)this.activeThumb="min";else{let s=this.localize.dir()==="rtl",n=this.orientation==="vertical",c=n?e:t,h=this.lastTrackPosition||c;this.lastTrackPosition=c;let d=c>h!==s&&!n||c<h&&n;this.activeThumb=d?"max":"min"}else this.activeThumb=i<=r?"min":"max";this.valueWhenDraggingStarted=this.activeThumb==="min"?this.minValue:this.maxValue}this.customStates.set("dragging",!0),this.setThumbValueFromCoordinates(t,e,this.activeThumb),this.showRangeTooltips()},move:(t,e)=>{this.activeThumb&&this.setThumbValueFromCoordinates(t,e,this.activeThumb)},stop:()=>{this.activeThumb&&(this.activeThumb==="min"?this.minValue:this.maxValue)!==this.valueWhenDraggingStarted&&(this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.hasInteracted=!0),this.hideRangeTooltips(),this.customStates.set("dragging",!1),this.valueWhenDraggingStarted=void 0,this.activeThumb=null}})):this.draggableTrack=new fi(this.slider,{start:(t,e)=>{this.trackBoundingClientRect=this.track.getBoundingClientRect(),this.valueWhenDraggingStarted=this.value,this.customStates.set("dragging",!0),this.setValueFromCoordinates(t,e),this.showTooltip()},move:(t,e)=>{this.setValueFromCoordinates(t,e)},stop:()=>{this.value!==this.valueWhenDraggingStarted&&(this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.hasInteracted=!0),this.hideTooltip(),this.customStates.set("dragging",!1),this.valueWhenDraggingStarted=void 0}})}willUpdate(t){this.isRange&&(t.has("minValue")||t.has("maxValue")||t.has("min")||t.has("max"))&&(this.minValue=W(this.minValue,this.min,this.maxValue),this.maxValue=W(this.maxValue,this.minValue,this.max)),super.willUpdate(t)}updated(t){if(this.isRange&&(t.has("minValue")||t.has("maxValue"))&&this.updateFormValue(),t.has("disabled")||t.has("readonly")){let e=!(this.disabled||this.readonly);this.isRange&&(this.draggableThumbMin&&this.draggableThumbMin.toggle(e),this.draggableThumbMax&&this.draggableThumbMax.toggle(e)),this.draggableTrack&&this.draggableTrack.toggle(e)}super.updated(t)}formDisabledCallback(t){this.disabled=t}formResetCallback(){this.isRange?(this.minValue=parseFloat(this.getAttribute("min-value")??String(this.min)),this.maxValue=parseFloat(this.getAttribute("max-value")??String(this.max))):(this._value=null,this.defaultValue=this.defaultValue??parseFloat(this.getAttribute("value")??String(this.min))),this.valueHasChanged=!1,this.hasInteracted=!1,super.formResetCallback()}clampAndRoundToStep(t){let e=(String(this.step).split(".")[1]||"").replace(/0+$/g,"").length,o=Number(this.step),i=Number(this.min),r=Number(this.max);return t=Math.round(t/o)*o,t=W(t,i,r),parseFloat(t.toFixed(e))}getPercentageFromValue(t){return(t-this.min)/(this.max-this.min)*100}getValueFromCoordinates(t,e){let o=this.localize.dir()==="rtl",i=this.orientation==="vertical",{top:r,right:s,bottom:n,left:c,height:h,width:d}=this.trackBoundingClientRect,u=i?e:t,b=i?{start:r,end:n,size:h}:{start:c,end:s,size:d},g=(i||o?b.end-u:u-b.start)/b.size;return this.clampAndRoundToStep(this.min+(this.max-this.min)*g)}handleBlur(){this.isRange?requestAnimationFrame(()=>{let t=this.shadowRoot?.activeElement;t===this.thumbMin||t===this.thumbMax||this.hideRangeTooltips()}):this.hideTooltip(),this.customStates.set("focused",!1),this.dispatchEvent(new FocusEvent("blur",{bubbles:!0,composed:!0}))}handleFocus(t){let e=t.target;this.isRange?(e===this.thumbMin?this.activeThumb="min":e===this.thumbMax&&(this.activeThumb="max"),this.showRangeTooltips()):this.showTooltip(),this.customStates.set("focused",!0),this.dispatchEvent(new FocusEvent("focus",{bubbles:!0,composed:!0}))}handleKeyDown(t){let e=this.localize.dir()==="rtl",o=t.target;if(this.disabled||this.readonly||this.isRange&&(o===this.thumbMin?this.activeThumb="min":o===this.thumbMax&&(this.activeThumb="max"),!this.activeThumb))return;let i=this.isRange?this.activeThumb==="min"?this.minValue:this.maxValue:this.value,r=i;switch(t.key){case"ArrowUp":case(e?"ArrowLeft":"ArrowRight"):t.preventDefault(),r=this.clampAndRoundToStep(i+this.step);break;case"ArrowDown":case(e?"ArrowRight":"ArrowLeft"):t.preventDefault(),r=this.clampAndRoundToStep(i-this.step);break;case"Home":t.preventDefault(),r=this.isRange&&this.activeThumb==="min"?this.min:this.isRange?this.minValue:this.min;break;case"End":t.preventDefault(),r=this.isRange&&this.activeThumb==="max"?this.max:this.isRange?this.maxValue:this.max;break;case"PageUp":t.preventDefault();let s=Math.max(i+(this.max-this.min)/10,i+this.step);r=this.clampAndRoundToStep(s);break;case"PageDown":t.preventDefault();let n=Math.min(i-(this.max-this.min)/10,i-this.step);r=this.clampAndRoundToStep(n);break;case"Enter":ho(t,this);return}r!==i&&(this.isRange?(this.activeThumb==="min"?r>this.maxValue?(this.maxValue=r,this.minValue=r):this.minValue=Math.max(this.min,r):r<this.minValue?(this.minValue=r,this.maxValue=r):this.maxValue=Math.min(this.max,r),this.updateFormValue()):this.value=W(r,this.min,this.max),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}),this.hasInteracted=!0)}handleLabelPointerDown(t){t.preventDefault(),this.disabled||(this.isRange?this.thumbMin?.focus():this.slider.focus())}setValueFromCoordinates(t,e){let o=this.value;this.value=this.getValueFromCoordinates(t,e),this.value!==o&&this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))})}setThumbValueFromCoordinates(t,e,o){let i=this.getValueFromCoordinates(t,e),r=o==="min"?this.minValue:this.maxValue;o==="min"?i>this.maxValue?(this.maxValue=i,this.minValue=i):this.minValue=Math.max(this.min,i):i<this.minValue?(this.minValue=i,this.maxValue=i):this.maxValue=Math.min(this.max,i),r!==(o==="min"?this.minValue:this.maxValue)&&(this.updateFormValue(),this.updateComplete.then(()=>{this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))}))}showTooltip(){this.withTooltip&&this.tooltip&&(this.tooltip.open=!0)}hideTooltip(){this.withTooltip&&this.tooltip&&(this.tooltip.open=!1)}showRangeTooltips(){if(!this.withTooltip)return;let t=this.shadowRoot?.getElementById("tooltip-thumb-min"),e=this.shadowRoot?.getElementById("tooltip-thumb-max");this.activeThumb==="min"?(t&&(t.open=!0),e&&(e.open=!1)):this.activeThumb==="max"&&(e&&(e.open=!0),t&&(t.open=!1))}hideRangeTooltips(){if(!this.withTooltip)return;let t=this.shadowRoot?.getElementById("tooltip-thumb-min"),e=this.shadowRoot?.getElementById("tooltip-thumb-max");t&&(t.open=!1),e&&(e.open=!1)}updateFormValue(t){if(this.isRange){let e=new FormData;e.append(this.name||"",String(this.minValue)),e.append(this.name||"",String(this.maxValue)),this.setValue(e,e);return}super.updateFormValue(t)}focus(){this.isRange?this.thumbMin?.focus():this.slider.focus()}blur(){if(this.isRange){for(let t of Qo())if(t===this.thumbMin){this.thumbMin.blur();break}else if(t===this.thumbMax){this.thumbMax.blur();break}}else this.slider.blur()}stepDown(){if(this.isRange){let t=this.clampAndRoundToStep(this.minValue-this.step);this.minValue=W(t,this.min,this.maxValue),this.updateFormValue()}else{let t=this.clampAndRoundToStep(this.value-this.step);this.value=t}}stepUp(){if(this.isRange){let t=this.clampAndRoundToStep(this.maxValue+this.step);this.maxValue=W(t,this.minValue,this.max),this.updateFormValue()}else{let t=this.clampAndRoundToStep(this.value+this.step);this.value=t}}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e,r=this.hasSlotController.test("reference"),s=_({xs:this.size==="xs",s:this.size==="s"||this.size==="small",m:this.size==="m"||this.size==="medium",l:this.size==="l"||this.size==="large",xl:this.size==="xl",small:this.size==="small"||this.size==="s",medium:this.size==="medium"||this.size==="m",large:this.size==="large"||this.size==="l",horizontal:this.orientation==="horizontal",vertical:this.orientation==="vertical",disabled:this.disabled}),n=[];if(this.withMarkers)for(let f=this.min;f<=this.max;f+=this.step)n.push(this.getPercentageFromValue(f));let c=p`
      <label
        id="label"
        part="label"
        for=${this.isRange?"thumb-min":"text-box"}
        class=${_({vh:!o,"has-label":o})}
        @pointerdown=${this.handleLabelPointerDown}
      >
        <slot name="label">${this.label}</slot>
      </label>
    `,h=p`
      <div
        id="hint"
        part="hint"
        class=${_({"has-slotted":i})}
      >
        <slot name="hint">${this.hint}</slot>
      </div>
    `,d=this.withMarkers?p`
          <div id="markers" part="markers">
            ${n.map(f=>p`<span part="marker" class="marker" style=${ct({"--position":`${f}%`})}></span>`)}
          </div>
        `:"",u=r?p`
          <div id="references" part="references" aria-hidden="true">
            <slot name="reference"></slot>
          </div>
        `:"",b=(f,g)=>this.withTooltip?p`
            <wa-tooltip
              id=${`tooltip${f!=="thumb"?"-"+f:""}`}
              part="tooltip"
              exportparts="
                base:tooltip__base,
                body:tooltip__body,
                arrow:tooltip__arrow
              "
              trigger="manual"
              distance=${this.tooltipDistance}
              placement=${this.tooltipPlacement}
              for=${f}
              activation="manual"
              dir=${this.localize.dir()}
            >
              <span aria-hidden="true">
                ${typeof this.valueFormatter=="function"?this.valueFormatter(g):this.localize.number(g)}
              </span>
            </wa-tooltip>
          `:"";if(this.isRange){let f=W(this.getPercentageFromValue(this.minValue),0,100),g=W(this.getPercentageFromValue(this.maxValue),0,100);return p`
        ${c}

        <div id="slider" part="slider" class=${s}>
          <div id="track" part="track">
            <div
              id="indicator"
              part="indicator"
              style=${ct({"--start":`${Math.min(f,g)}%`,"--end":`${Math.max(f,g)}%`})}
            ></div>

            ${d}

            <span
              id="thumb-min"
              part="thumb thumb-min"
              style=${ct({"--position":`${f}%`})}
              role="slider"
              aria-valuemin=${this.min}
              aria-valuenow=${this.minValue}
              aria-valuetext=${typeof this.valueFormatter=="function"?this.valueFormatter(this.minValue):this.localize.number(this.minValue)}
              aria-valuemax=${this.max}
              aria-label="${this.label?`${this.label} (minimum value)`:"Minimum value"}"
              aria-orientation=${this.orientation}
              aria-disabled=${this.disabled?"true":"false"}
              aria-readonly=${this.readonly?"true":"false"}
              tabindex=${this.disabled?-1:0}
              @blur=${this.handleBlur}
              @focus=${this.handleFocus}
              @keydown=${this.handleKeyDown}
            ></span>

            <span
              id="thumb-max"
              part="thumb thumb-max"
              style=${ct({"--position":`${g}%`})}
              role="slider"
              aria-valuemin=${this.min}
              aria-valuenow=${this.maxValue}
              aria-valuetext=${typeof this.valueFormatter=="function"?this.valueFormatter(this.maxValue):this.localize.number(this.maxValue)}
              aria-valuemax=${this.max}
              aria-label="${this.label?`${this.label} (maximum value)`:"Maximum value"}"
              aria-orientation=${this.orientation}
              aria-disabled=${this.disabled?"true":"false"}
              aria-readonly=${this.readonly?"true":"false"}
              tabindex=${this.disabled?-1:0}
              @blur=${this.handleBlur}
              @focus=${this.handleFocus}
              @keydown=${this.handleKeyDown}
            ></span>
          </div>

          ${u} ${h}
        </div>

        ${b("thumb-min",this.minValue)} ${b("thumb-max",this.maxValue)}
      `}else{let f=W(this.getPercentageFromValue(this.value),0,100),g=W(this.getPercentageFromValue(typeof this.indicatorOffset=="number"?this.indicatorOffset:this.min),0,100);return p`
        ${c}

        <div
          id="slider"
          part="slider"
          class=${s}
          role="slider"
          aria-disabled=${this.disabled?"true":"false"}
          aria-readonly=${this.disabled?"true":"false"}
          aria-orientation=${this.orientation}
          aria-valuemin=${this.min}
          aria-valuenow=${this.value}
          aria-valuetext=${typeof this.valueFormatter=="function"?this.valueFormatter(this.value):this.localize.number(this.value)}
          aria-valuemax=${this.max}
          aria-labelledby="label"
          aria-describedby="hint"
          tabindex=${this.disabled?-1:0}
          @blur=${this.handleBlur}
          @focus=${this.handleFocus}
          @keydown=${this.handleKeyDown}
        >
          <div id="track" part="track">
            <div
              id="indicator"
              part="indicator"
              style=${ct({"--start":`${g}%`,"--end":`${f}%`})}
            ></div>

            ${d}
            <span id="thumb" part="thumb" style=${ct({"--position":`${f}%`})}></span>
          </div>

          ${u} ${h}
        </div>

        ${b("thumb",this.value)}
      `}}};tt.formAssociated=!0;tt.observeSlots=!0;tt.css=[j,pt,_c];a([S("#slider")],tt.prototype,"slider",2);a([S("#thumb")],tt.prototype,"thumb",2);a([S("#thumb-min")],tt.prototype,"thumbMin",2);a([S("#thumb-max")],tt.prototype,"thumbMax",2);a([S("#track")],tt.prototype,"track",2);a([S("#tooltip")],tt.prototype,"tooltip",2);a([l()],tt.prototype,"label",2);a([l({attribute:"hint"})],tt.prototype,"hint",2);a([l({reflect:!0})],tt.prototype,"name",2);a([l({type:Number,attribute:"min-value"})],tt.prototype,"minValue",2);a([l({type:Number,attribute:"max-value"})],tt.prototype,"maxValue",2);a([l({attribute:"value",reflect:!0,type:Number})],tt.prototype,"defaultValue",2);a([A()],tt.prototype,"value",1);a([l({type:Boolean,reflect:!0})],tt.prototype,"range",2);a([l({type:Boolean})],tt.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],tt.prototype,"readonly",2);a([l({reflect:!0})],tt.prototype,"orientation",2);a([l({reflect:!0})],tt.prototype,"size",2);a([y("size")],tt.prototype,"handleSizeChange",1);a([l({attribute:"indicator-offset",type:Number})],tt.prototype,"indicatorOffset",2);a([l({type:Number})],tt.prototype,"min",2);a([l({type:Number})],tt.prototype,"max",2);a([l({type:Number})],tt.prototype,"step",2);a([l({type:Boolean})],tt.prototype,"autofocus",2);a([l({attribute:"tooltip-distance",type:Number})],tt.prototype,"tooltipDistance",2);a([l({attribute:"tooltip-placement",reflect:!0})],tt.prototype,"tooltipPlacement",2);a([l({attribute:"with-markers",type:Boolean})],tt.prototype,"withMarkers",2);a([l({attribute:"with-tooltip",type:Boolean})],tt.prototype,"withTooltip",2);a([l({attribute:"with-label",type:Boolean})],tt.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],tt.prototype,"withHint",2);a([l({attribute:!1})],tt.prototype,"valueFormatter",2);tt=a([k("wa-slider")],tt);var Tc=C`
  :host {
    --divider-width: 0.25rem;
    --divider-hit-area: 0.75rem;
    --min: 0%;
    --max: 100%;

    display: grid;
  }

  .start,
  .end {
    overflow: hidden;
  }

  .divider {
    flex: 0 0 var(--divider-width);
    display: flex;
    position: relative;
    align-items: center;
    justify-content: center;
    background-color: var(--wa-color-neutral-border-normal);
    color: var(--wa-color-neutral-on-normal);
    z-index: 1;
  }

  .divider:focus {
    outline: none;
  }

  :host(:not([disabled])) .divider:focus-visible {
    outline: var(--wa-focus-ring);
  }

  :host([disabled]) .divider {
    cursor: not-allowed;
  }

  /* Horizontal */
  :host(:not([orientation='vertical'], [disabled])) .divider {
    cursor: col-resize;
  }

  :host(:not([orientation='vertical'])) .divider::after {
    display: flex;
    content: '';
    position: absolute;
    height: 100%;
    left: calc(var(--divider-hit-area) / -2 + var(--divider-width) / 2);
    width: var(--divider-hit-area);
  }

  /* Vertical */
  :host([orientation='vertical']) {
    flex-direction: column;
  }

  :host([orientation='vertical']:not([disabled])) .divider {
    cursor: row-resize;
  }

  :host([orientation='vertical']) .divider::after {
    content: '';
    position: absolute;
    width: 100%;
    top: calc(var(--divider-hit-area) / -2 + var(--divider-width) / 2);
    height: var(--divider-hit-area);
  }

  @media (forced-colors: active) {
    .divider {
      outline: solid 1px transparent;
    }
  }
`;var te=class extends E{constructor(){super(...arguments),this.isCollapsed=!1,this.localize=new I(this),this.positionBeforeCollapsing=0,this.position=50,this.orientation="horizontal",this.disabled=!1,this.snapThreshold=12}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(t=>this.handleResize(t)),this.updateComplete.then(()=>this.resizeObserver.observe(this)),this.detectSize(),this.cachedPositionInPixels=this.percentageToPixels(this.position)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.unobserve(this)}detectSize(){let{width:t,height:e}=this.getBoundingClientRect();this.size=this.orientation==="vertical"?e:t}percentageToPixels(t){return this.size*(t/100)}pixelsToPercentage(t){return t/this.size*100}handleDrag(t){let e=this.didSSR&&!this.hasUpdated?this.dir==="rtl":this.localize.dir()==="rtl";this.disabled||(t.cancelable&&t.preventDefault(),so(this,{onMove:(o,i)=>{let r=this.orientation==="vertical"?i:o;this.primary==="end"&&(r=this.size-r),this.snap&&this.snap.split(" ").forEach(n=>{let c;n.endsWith("%")?c=this.size*(parseFloat(n)/100):c=parseFloat(n),e&&this.orientation==="horizontal"&&(c=this.size-c),r>=c-this.snapThreshold&&r<=c+this.snapThreshold&&(r=c)}),this.position=W(this.pixelsToPercentage(r),0,100)},initialEvent:t}))}handleKeyDown(t){if(!this.disabled&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Enter"].includes(t.key)){let e=this.position,o=(t.shiftKey?10:1)*(this.primary==="end"?-1:1);if(t.preventDefault(),(t.key==="ArrowLeft"&&this.orientation==="horizontal"||t.key==="ArrowUp"&&this.orientation==="vertical")&&(e-=o),(t.key==="ArrowRight"&&this.orientation==="horizontal"||t.key==="ArrowDown"&&this.orientation==="vertical")&&(e+=o),t.key==="Home"&&(e=this.primary==="end"?100:0),t.key==="End"&&(e=this.primary==="end"?0:100),t.key==="Enter")if(this.isCollapsed)e=this.positionBeforeCollapsing,this.isCollapsed=!1;else{let i=this.position;e=0,requestAnimationFrame(()=>{this.isCollapsed=!0,this.positionBeforeCollapsing=i})}this.position=W(e,0,100)}}handleResize(t){let{width:e,height:o}=t[0].contentRect;if(this.size=this.orientation==="vertical"?o:e,(isNaN(this.cachedPositionInPixels)||this.position===1/0)&&(this.cachedPositionInPixels=Number(this.getAttribute("position-in-pixels")),this.positionInPixels=Number(this.getAttribute("position-in-pixels")),this.position=this.pixelsToPercentage(this.positionInPixels)),this.primary){let i=this.pixelsToPercentage(this.cachedPositionInPixels);this.position!==i&&(this.position=i)}}handlePositionChange(){this.cachedPositionInPixels=this.percentageToPixels(this.position);let t=this.percentageToPixels(this.position);this.positionInPixels!==t&&(this.positionInPixels=t),this.isCollapsed=!1,this.positionBeforeCollapsing=0,this.dispatchEvent(new hr)}handlePositionInPixelsChange(){let t=this.pixelsToPercentage(this.positionInPixels);this.position!==t&&(this.position=t)}handleVerticalChange(){this.detectSize()}updateStyles(){let t=this.orientation==="vertical"?"gridTemplateRows":"gridTemplateColumns",e=this.orientation==="vertical"?"gridTemplateColumns":"gridTemplateRows",o=this.hasUpdated?this.localize.dir()==="rtl":this.dir==="rtl",i=`
      clamp(
        0%,
        clamp(
          var(--min),
          ${this.position}% - var(--divider-width) / 2,
          var(--max)
        ),
        calc(100% - var(--divider-width))
      )
    `,r="auto";this.primary==="end"?o&&this.orientation==="horizontal"?this.setStyle(t,`${i} var(--divider-width) ${r}`):this.setStyle(t,`${r} var(--divider-width) ${i}`):o&&this.orientation==="horizontal"?this.setStyle(t,`${r} var(--divider-width) ${i}`):this.setStyle(t,`${i} var(--divider-width) ${r}`),this.setStyle(e,"unset")}willUpdate(t){this.style||this.updateStyles(),super.willUpdate(t)}updated(t){super.updated(t)}render(){return this.style&&this.updateStyles(),p`
      <slot name="start" part="panel start" class="start"></slot>

      <div
        part="divider"
        class="divider"
        tabindex=${M(this.disabled?void 0:"0")}
        role="separator"
        aria-valuenow=${this.position}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${this.localize.term("resize")}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleDrag}
        @touchstart=${this.handleDrag}
      >
        <slot name="divider"></slot>
      </div>

      <slot name="end" part="panel end" class="end"></slot>
    `}};te.css=Tc;a([S(".divider")],te.prototype,"divider",2);a([l({type:Number,reflect:!0})],te.prototype,"position",2);a([l({attribute:"position-in-pixels",type:Number})],te.prototype,"positionInPixels",2);a([l({reflect:!0})],te.prototype,"orientation",2);a([l({type:Boolean,reflect:!0})],te.prototype,"disabled",2);a([l()],te.prototype,"primary",2);a([l()],te.prototype,"snap",2);a([l({type:Number,attribute:"snap-threshold"})],te.prototype,"snapThreshold",2);a([y("position")],te.prototype,"handlePositionChange",1);a([y("positionInPixels")],te.prototype,"handlePositionInPixelsChange",1);a([y("vertical")],te.prototype,"handleVerticalChange",1);te=a([k("wa-split-panel")],te);var Mc=C`
  :host {
    --height: var(--wa-form-control-toggle-size);
    --width: calc(var(--height) * 1.75);
    --thumb-size: 0.75em;

    display: inline-flex;
    line-height: var(--wa-form-control-value-line-height);
  }

  label {
    position: relative;
    display: flex;
    align-items: center;
    font: inherit;
    color: var(--wa-form-control-value-color);
    vertical-align: middle;
    cursor: pointer;
  }

  .switch {
    flex: 0 0 auto;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--width);
    height: var(--height);
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--height);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    transition-property: translate, background, border-color, box-shadow;
    transition-duration: var(--wa-transition-normal);
    transition-timing-function: var(--wa-transition-easing);
  }

  :host([did-ssr]:not(:defined)) .switch {
    transition-property: unset;
    transition-duration: unset;
    transition-timing-function: unset;
  }

  .switch .thumb {
    aspect-ratio: 1 / 1;
    width: var(--thumb-size);
    height: var(--thumb-size);
    background-color: var(--wa-form-control-border-color);
    border-radius: 50%;
    translate: calc((var(--width) - var(--height)) / -2);
    transition: inherit;
  }
  .switch .thumb:dir(rtl) {
    translate: calc((var(--width) - var(--height)) / 2);
  }

  .input {
    position: absolute;
    opacity: 0;
    padding: 0;
    margin: 0;
    pointer-events: none;
  }

  /* Focus */
  label:not(.disabled) .input:focus-visible ~ .switch .thumb {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
  }

  /* Checked */
  .checked .switch {
    background-color: var(--wa-form-control-activated-color);
    border-color: var(--wa-form-control-activated-color);
  }

  .checked .switch .thumb {
    background-color: var(--wa-color-surface-default);
    translate: calc((var(--width) - var(--height)) / 2);
  }
  .checked .switch .thumb:dir(rtl) {
    translate: calc((var(--width) - var(--height)) / -2);
  }

  /* Disabled */
  label:has(> :disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [part~='label'] {
    display: inline-block;
    line-height: var(--height);
    margin-inline-start: 0.5em;
    user-select: none;
    -webkit-user-select: none;
  }

  :host([required]) [part~='label']::after {
    content: var(--wa-form-control-required-content);
    color: var(--wa-form-control-required-content-color);
    margin-inline-start: var(--wa-form-control-required-content-offset);
  }

  @media (forced-colors: active) {
    :checked:enabled + .switch:hover .thumb,
    :checked + .switch .thumb {
      background-color: ButtonText;
    }
  }
`;var _t=class extends q{constructor(){super(...arguments),this.hasSlotController=new Z(this,"hint"),this.localize=new I(this),this.title="",this.name=null,this._value=this.getAttribute("value")??null,this.size="m",this.disabled=!1,this._checked=null,this.defaultChecked=this.hasAttribute("checked"),this.required=!1,this.hint="",this.withHint=!1}static get validators(){return[...super.validators,jt()]}get value(){return this._value??"on"}set value(t){this._value=t}handleSizeChange(){U(this.localName,this.size)}get checked(){return this.valueHasChanged?!!this._checked:this._checked??this.defaultChecked}set checked(t){this._checked=!!t,this.valueHasChanged=!0}handleClick(){this.hasInteracted=!0,this.checked=!this.checked,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))})}handleKeyDown(t){let e=this.localize.dir()==="rtl";t.key==="ArrowLeft"&&(t.preventDefault(),this.checked=e,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))})),t.key==="ArrowRight"&&(t.preventDefault(),this.checked=!e,this.updateComplete.then(()=>{this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0}))}))}willUpdate(t){super.willUpdate(t),(t.has("value")||t.has("checked")||t.has("defaultChecked")||t.has("disabled"))&&this.handleValueOrCheckedChange()}handleValueOrCheckedChange(){if(this.didSSR&&!this.hasUpdated){this.updateComplete.then(()=>{this.handleValueOrCheckedChange()});return}this.setValue(this.checked?this.value:null,this._value),this.updateValidity()}handleStateChange(){this.hasUpdated&&(this.input.checked=this.checked),this.customStates.set("checked",this.checked),this.updateValidity()}handleDisabledChange(){this.updateValidity()}click(){this.input.click()}focus(t){this.input.focus(t)}blur(){this.input.blur()}setValue(t,e){if(!this.checked){this.internals.setFormValue(null,null);return}this.internals.setFormValue(t??"on",e)}formResetCallback(){this._checked=null,super.formResetCallback(),this.handleValueOrCheckedChange()}render(){let t=this.hasSlotController.test("hint","withHint"),e=this.hint?!0:!!t,o=this.didSSR&&!this.hasUpdated?this.checked:this.defaultChecked,i=this.didSSR&&!this.hasUpdated?null:Mt(this.checked);return p`
      <label
        part="base switch"
        class=${_({checked:this.checked,disabled:this.disabled})}
      >
        <input
          class="input"
          type="checkbox"
          title=${this.title}
          name=${M(this.name)}
          value=${M(this.value)}
          .checked=${M(i)}
          ?checked=${o}
          ?disabled=${this.disabled}
          ?required=${this.required}
          role="switch"
          aria-checked=${this.checked?"true":"false"}
          aria-describedby="hint"
          @click=${this.handleClick}
          @keydown=${this.handleKeyDown}
        />

        <span part="control" class="switch">
          <span part="thumb" class="thumb"></span>
        </span>

        <slot part="label" class="label"></slot>
      </label>

      <slot
        id="hint"
        name="hint"
        part="hint"
        class=${_({"has-slotted":e})}
        aria-hidden=${e?"false":"true"}
        >${this.hint}</slot
      >
    `}};_t.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};_t.css=[pt,j,Mc];a([S('input[type="checkbox"]')],_t.prototype,"input",2);a([l()],_t.prototype,"title",2);a([l({reflect:!0})],_t.prototype,"name",2);a([l({reflect:!0})],_t.prototype,"value",1);a([l({reflect:!0})],_t.prototype,"size",2);a([y("size")],_t.prototype,"handleSizeChange",1);a([l({type:Boolean})],_t.prototype,"disabled",2);a([l({type:Boolean,attribute:!1})],_t.prototype,"checked",1);a([l({type:Boolean,attribute:"checked",reflect:!0})],_t.prototype,"defaultChecked",2);a([l({type:Boolean,reflect:!0})],_t.prototype,"required",2);a([l({attribute:"hint"})],_t.prototype,"hint",2);a([l({attribute:"with-hint",type:Boolean})],_t.prototype,"withHint",2);a([y(["checked","defaultChecked"])],_t.prototype,"handleStateChange",1);a([y("disabled",{waitUntilFirstUpdate:!0})],_t.prototype,"handleDisabledChange",1);_t=a([k("wa-switch")],_t);_t.disableWarning?.("change-in-update");var Ic=C`
  :host {
    display: inline-block;
    color: var(--wa-color-neutral-on-quiet);
    font-weight: var(--wa-font-weight-action);
  }

  .tab {
    display: inline-flex;
    align-items: center;
    font: inherit;
    padding: 1em 1.5em;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition: color var(--wa-transition-fast) var(--wa-transition-easing);

    ::slotted(wa-icon:first-child) {
      margin-inline-end: 0.5em;
    }

    ::slotted(wa-icon:last-child) {
      margin-inline-start: 0.5em;
    }
  }

  @media (hover: hover) {
    :host(:hover:not([disabled])) .tab {
      color: currentColor;
    }
  }

  :host(:focus) {
    outline: transparent;
  }

  :host(:focus-visible) .tab {
    outline: var(--wa-focus-ring);
    outline-offset: calc(-1 * var(--wa-border-width-l) - var(--wa-focus-ring-offset));
  }

  :host([active]:not([disabled])) {
    color: var(--wa-color-brand-on-quiet);
  }

  :host([disabled]) .tab {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (forced-colors: active) {
    :host([active]:not([disabled])) {
      outline: solid 1px transparent;
      outline-offset: -3px;
    }
  }
`;var am=0,pe=class extends E{constructor(){super(...arguments),this.attrId=++am,this.componentId=`wa-tab-${this.attrId}`,this.panel="",this.active=!1,this.disabled=!1,this.tabIndex=0,this.slot="nav",this.role="tab"}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id?.length>0?this.id:this.componentId,p`
      <div
        part="base tab"
        class=${_({tab:!0,"tab-active":this.active})}
      >
        <slot></slot>
      </div>
    `}};pe.css=Ic;a([S(".tab")],pe.prototype,"tab",2);a([l({reflect:!0})],pe.prototype,"panel",2);a([l({type:Boolean,reflect:!0})],pe.prototype,"active",2);a([l({type:Boolean,reflect:!0})],pe.prototype,"disabled",2);a([l({type:Number,reflect:!0})],pe.prototype,"tabIndex",2);a([l({reflect:!0})],pe.prototype,"slot",2);a([l({reflect:!0})],pe.prototype,"role",2);a([y("active")],pe.prototype,"handleActiveChange",1);a([y("disabled")],pe.prototype,"handleDisabledChange",1);pe=a([k("wa-tab")],pe);var Dc=class extends Event{constructor(t){super("wa-tab-hide",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Rc=class extends Event{constructor(t){super("wa-tab-show",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Pc=C`
  :host {
    --indicator-color: var(--wa-color-brand-fill-loud);
    --track-color: var(--wa-color-neutral-fill-normal);
    --track-width: 0.125rem;

    /* Private */
    --safe-track-width: max(0.5px, round(var(--track-width), 0.5px));

    display: block;
  }

  .tab-group {
    display: flex;
    border-radius: 0;
  }

  .tabs {
    display: flex;
    position: relative;
  }

  .indicator {
    position: absolute;
  }

  .tab-group-has-scroll-controls .nav-container {
    position: relative;
    padding: 0 1.5em;
  }

  .body {
    display: block;
  }

  .scroll-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1.5em;
  }

  .scroll-button-start {
    inset-inline-start: 0;
  }

  .scroll-button-end {
    inset-inline-end: 0;
  }

  /*
    * Top
    */

  .tab-group-top {
    flex-direction: column;
  }

  .tab-group-top .nav-container {
    order: 1;
  }

  .tab-group-top .nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group-top .nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group-top .tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-bottom: solid var(--safe-track-width) var(--track-color);
  }

  .tab-group-top .indicator {
    bottom: calc(-1 * var(--safe-track-width));
    border-bottom: solid var(--safe-track-width) var(--indicator-color);
  }

  .tab-group-top .body {
    order: 2;
  }

  .tab-group-top ::slotted(wa-tab[active]) {
    border-block-end: solid var(--safe-track-width) var(--indicator-color);
    margin-block-end: calc(-1 * var(--safe-track-width));
  }

  .tab-group-top .body slot::slotted(wa-tab-panel) {
    --padding: var(--wa-space-xl) 0;
  }

  /*
    * Bottom
    */

  .tab-group-bottom {
    flex-direction: column;
  }

  .tab-group-bottom .nav-container {
    order: 2;
  }

  .tab-group-bottom .nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group-bottom .nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group-bottom .tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-top: solid var(--safe-track-width) var(--track-color);
  }

  .tab-group-bottom .indicator {
    top: calc(-1 * var(--safe-track-width));
    border-top: solid var(--safe-track-width) var(--indicator-color);
  }

  .tab-group-bottom .body {
    order: 1;
  }

  .tab-group-bottom ::slotted(wa-tab[active]) {
    border-block-start: solid var(--safe-track-width) var(--indicator-color);
    margin-block-start: calc(-1 * var(--safe-track-width));
  }

  .tab-group-bottom .body slot::slotted(wa-tab-panel) {
    --padding: var(--wa-space-xl) 0;
  }

  /*
    * Start
    */

  .tab-group-start {
    flex-direction: row;
  }

  .tab-group-start .nav-container {
    order: 1;
  }

  .tab-group-start .tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-inline-end: solid var(--safe-track-width) var(--track-color);
  }

  .tab-group-start .indicator {
    inset-inline-end: calc(-1 * var(--safe-track-width));
    border-right: solid var(--safe-track-width) var(--indicator-color);
  }

  .tab-group-start .body {
    flex: 1 1 auto;
    order: 2;
  }

  .tab-group-start ::slotted(wa-tab[active]) {
    border-inline-end: solid var(--safe-track-width) var(--indicator-color);
    margin-inline-end: calc(-1 * var(--safe-track-width));
  }

  .tab-group-start .body slot::slotted(wa-tab-panel) {
    --padding: 0 var(--wa-space-xl);
  }

  /*
    * End
    */

  .tab-group-end {
    flex-direction: row;
  }

  .tab-group-end .nav-container {
    order: 2;
  }

  .tab-group-end .tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-left: solid var(--safe-track-width) var(--track-color);
  }

  .tab-group-end .indicator {
    inset-inline-start: calc(-1 * var(--safe-track-width));
    border-inline-start: solid var(--safe-track-width) var(--indicator-color);
  }

  .tab-group-end .body {
    flex: 1 1 auto;
    order: 1;
  }

  .tab-group-end ::slotted(wa-tab[active]) {
    border-inline-start: solid var(--safe-track-width) var(--indicator-color);
    margin-inline-start: calc(-1 * var(--safe-track-width));
  }

  .tab-group-end .body slot::slotted(wa-tab-panel) {
    --padding: 0 var(--wa-space-xl);
  }
`;var re=class extends E{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new I(this),this.hasScrollControls=!1,this.active="",this.placement="top",this.activation="auto",this.withoutScrollControls=!1}connectedCallback(){super.connectedCallback(),!!1&&(this.resizeObserver=new ResizeObserver(()=>{this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{t.some(o=>!["aria-labelledby","aria-controls"].includes(o.attributeName))&&setTimeout(()=>this.setAriaLabels());let e=t.filter(o=>o.target.closest("wa-tab-group")===this);if(e.some(o=>o.attributeName==="disabled"))this.syncTabsAndPanels();else if(e.some(o=>o.attributeName==="active")){let i=e.filter(r=>r.attributeName==="active"&&r.target.tagName.toLowerCase()==="wa-tab").map(r=>r.target).find(r=>r.active);i&&i.closest("wa-tab-group")===this&&this.setActiveTab(i)}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),new IntersectionObserver((e,o)=>{if(e[0].intersectionRatio>0){if(this.setAriaLabels(),this.active){let i=this.tabs.find(r=>r.panel===this.active);i&&this.setActiveTab(i)}else this.setActiveTab(this.getActiveTab()??this.tabs[0],{emitEvents:!1});o.unobserve(e[0].target)}}).observe(this.tabGroup)}))}disconnectedCallback(){super.disconnectedCallback(),this.mutationObserver?.disconnect(),this.nav&&this.resizeObserver?.unobserve(this.nav)}getAllTabs(){return[...this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()].filter(e=>e.tagName.toLowerCase()==="wa-tab")}getAllPanels(){return[...this.defaultSlot.assignedElements()].filter(t=>t.tagName.toLowerCase()==="wa-tab-panel")}getActiveTab(){return this.tabs.find(t=>t.active)}handleClick(t){let o=t.target.closest("wa-tab");o?.closest("wa-tab-group")===this&&o!==null&&this.setActiveTab(o,{scrollBehavior:"smooth"})}handleKeyDown(t){let o=t.target.closest("wa-tab");if(o?.closest("wa-tab-group")===this){if(["Enter"," "].includes(t.key)){o!==null&&(this.setActiveTab(o,{scrollBehavior:"smooth"}),t.preventDefault());return}if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key)){let r=this.tabs.find(c=>c.matches(":focus")),s=this.localize.dir()==="rtl",n=null;if(r?.tagName.toLowerCase()==="wa-tab"){if(t.key==="Home")n=this.focusableTabs[0];else if(t.key==="End")n=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&t.key===(s?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&t.key==="ArrowUp"){let c=this.tabs.findIndex(h=>h===r);n=this.findNextFocusableTab(c,"backward")}else if(["top","bottom"].includes(this.placement)&&t.key===(s?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&t.key==="ArrowDown"){let c=this.tabs.findIndex(h=>h===r);n=this.findNextFocusableTab(c,"forward")}if(!n)return;n.tabIndex=0,n.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(n,{scrollBehavior:"smooth"}):this.tabs.forEach(c=>{c.tabIndex=c===n?0:-1}),["top","bottom"].includes(this.placement)&&go(n,this.nav,"horizontal"),t.preventDefault()}}}}findNextFocusableTab(t,e){let o=null,i=e==="forward"?1:-1,r=t+i;for(;t<this.tabs.length;){if(o=this.tabs[r]||null,o===null){e==="forward"?o=this.focusableTabs[0]:o=this.focusableTabs[this.focusableTabs.length-1];break}if(!o.disabled)break;r+=i}return o}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(t,e){if(e={emitEvents:!0,scrollBehavior:"auto",...e},t.closest("wa-tab-group")===this&&t!==this.activeTab&&!t.disabled){let o=this.activeTab;this.active=t.panel,this.activeTab=t,this.tabs.forEach(i=>{i.active=i===this.activeTab,i.tabIndex=i===this.activeTab?0:-1}),this.panels.forEach(i=>i.active=i.name===this.activeTab?.panel),["top","bottom"].includes(this.placement)&&go(this.activeTab,this.nav,"horizontal",e.scrollBehavior),e.emitEvents&&(o&&this.dispatchEvent(new Dc({name:o.panel})),this.dispatchEvent(new Rc({name:this.activeTab.panel})))}}setAriaLabels(){this.tabs.forEach(t=>{let e=this.panels.find(o=>o.name===t.panel);e&&(t.setAttribute("aria-controls",e.getAttribute("id")),e.setAttribute("aria-labelledby",t.getAttribute("id")))})}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(t=>!t.disabled),this.panels=this.getAllPanels(),this.updateComplete.then(()=>this.updateScrollControls())}updateActiveTab(){let t=this.tabs.find(e=>e.panel===this.active);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}updateScrollControls(){this.withoutScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1}render(){let t=this.hasUpdated?this.localize.dir()==="rtl":this.dir==="rtl";return p`
      <div
        part="base tab-group"
        class=${_({"tab-group":!0,"tab-group-top":this.placement==="top","tab-group-bottom":this.placement==="bottom","tab-group-start":this.placement==="start","tab-group-end":this.placement==="end","tab-group-has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="nav-container" part="nav">
          ${this.hasScrollControls?p`
                <wa-button
                  part="scroll-button scroll-button-start"
                  exportparts="base:scroll-button__base"
                  class="scroll-button scroll-button-start"
                  appearance="plain"
                  @click=${this.handleScrollToStart}
                >
                  <wa-icon
                    name=${t?"chevron-right":"chevron-left"}
                    library="system"
                    variant="solid"
                    label=${this.localize.term("scrollToStart")}
                  ></wa-icon>
                </wa-button>
              `:""}

          <!-- We have a focus listener because in Firefox (and soon to be Chrome) overflow containers are focusable. -->
          <div class="nav" @focus=${()=>this.activeTab?.focus({preventScroll:!0})}>
            <div part="tabs" class="tabs" role="tablist">
              <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
            </div>
          </div>

          ${this.hasScrollControls?p`
                <wa-button
                  part="scroll-button scroll-button-end"
                  class="scroll-button scroll-button-end"
                  exportparts="base:scroll-button__base"
                  appearance="plain"
                  @click=${this.handleScrollToEnd}
                >
                  <wa-icon
                    name=${t?"chevron-left":"chevron-right"}
                    library="system"
                    variant="solid"
                    label=${this.localize.term("scrollToEnd")}
                  ></wa-icon>
                </wa-button>
              `:""}
        </div>

        <div part="body" class="body"><slot @slotchange=${this.syncTabsAndPanels}></slot></div>
      </div>
    `}};re.css=Pc;a([S(".tab-group")],re.prototype,"tabGroup",2);a([S(".body slot")],re.prototype,"defaultSlot",2);a([S(".nav")],re.prototype,"nav",2);a([A()],re.prototype,"hasScrollControls",2);a([l({reflect:!0})],re.prototype,"active",2);a([l()],re.prototype,"placement",2);a([l()],re.prototype,"activation",2);a([l({attribute:"without-scroll-controls",type:Boolean})],re.prototype,"withoutScrollControls",2);a([y("active")],re.prototype,"updateActiveTab",1);a([y("withoutScrollControls",{waitUntilFirstUpdate:!0})],re.prototype,"updateScrollControls",1);re=a([k("wa-tab-group")],re);var Oc=C`
  :host {
    --padding: 0;

    display: none;
  }

  :host([active]) {
    display: block;
  }

  .tab-panel {
    display: block;
    padding: var(--padding);
  }
`;var sm=0,yo=class extends E{constructor(){super(...arguments),this.attrId=++sm,this.componentId=`wa-tab-panel-${this.attrId}`,this.name="",this.active=!1,this.role="tabpanel"}connectedCallback(){super.connectedCallback(),this.id=(this.id||"").length>0?this.id:this.componentId}handleActiveChange(){this.setAttribute("aria-hidden",this.active?"false":"true")}render(){return p`
      <slot
        part="base"
        class=${_({"tab-panel":!0,"tab-panel-active":this.active})}
      ></slot>
    `}};yo.css=Oc;a([l({reflect:!0})],yo.prototype,"name",2);a([l({type:Boolean,reflect:!0})],yo.prototype,"active",2);a([l({reflect:!0})],yo.prototype,"role",2);a([y("active")],yo.prototype,"handleActiveChange",1);yo=a([k("wa-tab-panel")],yo);var Bc=C`
  :host {
    border-width: 0;
  }

  .textarea {
    display: grid;
    align-items: center;
    margin: 0;
    border: none;
    outline: none;
    cursor: inherit;
    font: inherit;
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    -webkit-appearance: none;
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);

    &:focus-within {
      outline-color: var(--wa-color-focus);
    }

    /* Style disabled textareas */
    &:has(:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  /* Appearance modifiers */
  :host([appearance='outlined']) .textarea {
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
  }

  :host([appearance='filled']) .textarea {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-color-neutral-fill-quiet);
  }

  :host([appearance='filled-outlined']) .textarea {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-color: var(--wa-form-control-border-color);
  }

  textarea {
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: inherit;
    scroll-padding-block: var(--wa-form-control-padding-block);
    padding: calc(var(--wa-form-control-padding-block) - ((1lh - 1em) / 2)) var(--wa-form-control-padding-inline); /* accounts for the larger line height of textarea content */
    min-height: calc(var(--wa-form-control-height) - var(--border-width) * 2);
    box-shadow: none;
    margin: 0;

    &::placeholder {
      color: var(--wa-form-control-placeholder-color);
      user-select: none;
      -webkit-user-select: none;
    }

    &:autofill {
      &,
      &:hover,
      &:focus,
      &:active {
        box-shadow: none;
        caret-color: var(--wa-form-control-value-color);
      }
    }

    &:focus {
      outline: none;
    }
  }

  /* Shared textarea and size-adjuster positioning */
  .control,
  .size-adjuster {
    grid-area: 1 / 1 / 2 / 2;
  }

  .size-adjuster {
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
    padding: 0;
  }

  textarea::-webkit-search-decoration,
  textarea::-webkit-search-cancel-button,
  textarea::-webkit-search-results-button,
  textarea::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /*
   * Resize types
   */

  :host([resize='none']) textarea {
    resize: none;
  }

  textarea,
  :host([resize='vertical']) textarea {
    resize: vertical;
  }

  :host([resize='horizontal']) textarea {
    resize: horizontal;
  }

  :host([resize='both']) textarea {
    resize: both;
  }

  :host([resize='auto']) textarea {
    height: auto;
    resize: none;
    overflow-y: hidden;
  }

  /*
   * Footer (hint + character count)
   */

  .footer {
    display: flex;
    align-items: baseline;
    gap: 1em;
  }

  .footer.has-count [part='hint'] {
    flex: 1 1 auto;
    min-width: 0;
  }

  .count {
    flex: 0 0 auto;
    color: var(--wa-form-control-hint-color);
    font-weight: var(--wa-form-control-hint-font-weight);
    line-height: var(--wa-form-control-hint-line-height);
    margin-block-start: 0.5em;
    font-size: var(--wa-font-size-smaller);
    margin-inline-start: auto;
  }
`;var Q=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["blur","input"],this.hasSlotController=new Z(this,"hint","label"),this.localize=new I(this),this.announcedCountText="",this.title="",this.name=null,this._value=null,this.defaultValue=this.getAttribute("value")??"",this.size="m",this.appearance="outlined",this.label="",this.hint="",this.placeholder="",this.rows=4,this.resize="vertical",this.disabled=!1,this.readonly=!1,this.required=!1,this.spellcheck=!0,this.withLabel=!1,this.withHint=!1,this.withCount=!1,this.lastObservedWidth=0}static get validators(){return[...super.validators,jt()]}get value(){return this.valueHasChanged?this._value:this._value??this.defaultValue}set value(t){this._value!==t&&(this.valueHasChanged=!0,this._value=t)}handleSizeChange(){U(this.localName,this.size)}connectedCallback(){super.connectedCallback(),this.updateComplete.then(()=>{if(this.setTextareaDimensions(),this.updateResizeObserver(),this.didSSR&&this.input&&this.value!==this.input.value){let t=this.input.value;this.value=t}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.countAnnounceTimeout),this.resizeObserver?.disconnect(),this.resizeObserver=void 0}updateFormValue(t){if(t==null){this.setValue("",null);return}super.updateFormValue(t)}updateResizeObserver(){let t=this.resize!=="none";this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=void 0),t&&this.input&&(this.resize==="auto"?(this.resizeObserver=new ResizeObserver(e=>{let o=e[0]?.contentRect.width??0;o!==this.lastObservedWidth&&(this.lastObservedWidth=o,requestAnimationFrame(()=>this.setTextareaDimensions()))}),this.resizeObserver.observe(this)):(this.resizeObserver=new ResizeObserver(()=>this.setTextareaDimensions()),this.resizeObserver.observe(this.input)))}handleBlur(){this.checkValidity()}handleChange(t){this.valueHasChanged=!0,this.value=this.input.value,this.setTextareaDimensions(),this.checkValidity(),this.relayNativeEvent(t,{bubbles:!0,composed:!0})}handleInput(t){this.valueHasChanged=!0,this.value=this.input.value,this.relayNativeEvent(t,{bubbles:!0,composed:!0}),this.scheduleCountAnnouncement()}scheduleCountAnnouncement(){clearTimeout(this.countAnnounceTimeout),this.countAnnounceTimeout=setTimeout(()=>{let t=(this.value??"").length;this.announcedCountText=this.maxlength!=null?this.localize.term("numCharactersRemaining",this.maxlength-t):this.localize.term("numCharacters",t)},1e3)}setTextareaDimensions(){if(this.resize==="none"){this.base.style.width="",this.base.style.height="";return}if(this.resize==="auto"){this.sizeAdjuster.style.height=`${this.input.clientHeight}px`,this.input.style.height="auto";let t=this.input.scrollHeight;this.input.style.height=`${t}px`,this.sizeAdjuster.style.height=`${t}px`,this.base.style.width="",this.base.style.height="";return}if(this.input.style.width){let t=Number(this.input.style.width.split(/px/)[0])+2;this.base.style.width=`${t}px`}if(this.input.style.height){let t=Number(this.input.style.height.split(/px/)[0])+2;this.base.style.height=`${t}px`}}handleRowsChange(){this.setTextareaDimensions()}async handleValueChange(){await this.updateComplete,this.checkValidity(),this.setTextareaDimensions()}updated(t){t.has("resize")&&(this.setTextareaDimensions(),this.updateResizeObserver()),super.updated(t),t.has("value")&&this.customStates.set("blank",!this.value)}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}scrollPosition(t){if(t){typeof t.top=="number"&&(this.input.scrollTop=t.top),typeof t.left=="number"&&(this.input.scrollLeft=t.left);return}return{top:this.input.scrollTop,left:this.input.scrollTop}}setSelectionRange(t,e,o="none"){this.input.setSelectionRange(t,e,o)}setRangeText(t,e,o,i="preserve"){let r=e??this.input.selectionStart,s=o??this.input.selectionEnd;this.input.setRangeText(t,r,s,i),this.value!==this.input.value&&(this.value=this.input.value,this.setTextareaDimensions())}formResetCallback(){this._value=null,this.input&&(this.input.value=this.value||""),super.formResetCallback()}render(){let t=this.hasSlotController.test("label","withLabel"),e=this.hasSlotController.test("hint","withHint"),o=this.label?!0:!!t,i=this.hint?!0:!!e,r=(this.value??"").length,s=this.maxlength!=null?this.localize.term("numCharactersRemaining",this.maxlength-r):this.localize.term("numCharacters",r);return p`
      <label
        part="form-control-label label"
        class=${_({label:!0,"has-label":o})}
        for="input"
        aria-hidden=${o?"false":"true"}
      >
        <slot name="label">${this.label}</slot>
      </label>

      <div part="base textarea-wrapper" class="textarea">
        <textarea
          part="textarea"
          id="input"
          class="control"
          title=${this.title}
          name=${M(this.name)}
          .value=${Mt(this.value)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          placeholder=${M(this.placeholder)}
          rows=${M(this.rows)}
          minlength=${M(this.minlength)}
          maxlength=${M(this.maxlength)}
          autocapitalize=${M(this.autocapitalize)}
          autocorrect=${M(this.autocorrect)}
          ?autofocus=${this.autofocus}
          spellcheck=${M(this.spellcheck)}
          enterkeyhint=${M(this.enterkeyhint)}
          inputmode=${M(this.inputmode)}
          aria-describedby="hint"
          @change=${this.handleChange}
          @input=${this.handleInput}
          @blur=${this.handleBlur}
        ></textarea>

        <!-- This "adjuster" exists to prevent layout shifting. https://github.com/shoelace-style/shoelace/issues/2180 -->
        <div part="textarea-adjuster" class="size-adjuster" ?hidden=${this.resize!=="auto"}></div>
      </div>

      <div
        class=${_({footer:!0,"has-count":this.withCount})}
      >
        <slot
          id="hint"
          name="hint"
          part="hint"
          aria-hidden=${i?"false":"true"}
          class=${_({"has-slotted":i})}
          >${this.hint}</slot
        >

        ${this.withCount?p`
              <div part="count" class="count" aria-hidden="true">${s}</div>
              <div class="wa-visually-hidden-force" aria-live="polite">${this.announcedCountText}</div>
            `:""}
      </div>
    `}};Q.css=[Bc,pt,j,Pe];a([A()],Q.prototype,"announcedCountText",2);a([S(".control")],Q.prototype,"input",2);a([S('[part~="base"]')],Q.prototype,"base",2);a([S(".size-adjuster")],Q.prototype,"sizeAdjuster",2);a([l()],Q.prototype,"title",2);a([l({reflect:!0})],Q.prototype,"name",2);a([A()],Q.prototype,"value",1);a([l({attribute:"value",reflect:!0})],Q.prototype,"defaultValue",2);a([l({reflect:!0})],Q.prototype,"size",2);a([y("size")],Q.prototype,"handleSizeChange",1);a([l({reflect:!0})],Q.prototype,"appearance",2);a([l()],Q.prototype,"label",2);a([l({attribute:"hint"})],Q.prototype,"hint",2);a([l()],Q.prototype,"placeholder",2);a([l({type:Number})],Q.prototype,"rows",2);a([l({reflect:!0})],Q.prototype,"resize",2);a([l({type:Boolean})],Q.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],Q.prototype,"readonly",2);a([l({type:Boolean,reflect:!0})],Q.prototype,"required",2);a([l({type:Number})],Q.prototype,"minlength",2);a([l({type:Number})],Q.prototype,"maxlength",2);a([l()],Q.prototype,"autocapitalize",2);a([l({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="off"),toAttribute:t=>t?"on":"off"}})],Q.prototype,"autocorrect",2);a([l()],Q.prototype,"autocomplete",2);a([l({type:Boolean})],Q.prototype,"autofocus",2);a([l()],Q.prototype,"enterkeyhint",2);a([l({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="false"),toAttribute:t=>t?"true":"false"}})],Q.prototype,"spellcheck",2);a([l()],Q.prototype,"inputmode",2);a([l({attribute:"with-label",type:Boolean})],Q.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],Q.prototype,"withHint",2);a([l({attribute:"with-count",type:Boolean,reflect:!0})],Q.prototype,"withCount",2);a([y("rows",{waitUntilFirstUpdate:!0})],Q.prototype,"handleRowsChange",1);a([y("value",{waitUntilFirstUpdate:!0})],Q.prototype,"handleValueChange",1);Q=a([k("wa-textarea")],Q);Q.disableWarning?.("change-in-update");var Ga=new Map;function Fc(t,e){let o=`${t||"en"}|${e.hour12?12:24}|${e.withSeconds?1:0}`,i=Ga.get(o);if(i)return i;let r=new Intl.DateTimeFormat(t||"en",{hour:"2-digit",minute:"2-digit",second:e.withSeconds?"2-digit":void 0,hour12:e.hour12,calendar:"gregory",numberingSystem:"latn"}),s=new Date(2026,0,1,13,45,30),n=r.formatToParts(s),c=[],h=[];for(let b of n)b.type==="hour"?(c.push({kind:"segment",field:"hour"}),h.push("hour")):b.type==="minute"?(c.push({kind:"segment",field:"minute"}),h.push("minute")):b.type==="second"?(c.push({kind:"segment",field:"second"}),h.push("second")):b.type==="dayPeriod"?(c.push({kind:"segment",field:"dayPeriod"}),h.push("dayPeriod")):b.type==="literal"&&c.push({kind:"literal",text:b.value});let d=2+(e.withSeconds?1:0)+(e.hour12?1:0);if(h.length!==d){let b=[{kind:"segment",field:"hour"},{kind:"literal",text:":"},{kind:"segment",field:"minute"}],f=["hour","minute"];e.withSeconds&&(b.push({kind:"literal",text:":"}),b.push({kind:"segment",field:"second"}),f.push("second")),e.hour12&&(b.push({kind:"literal",text:" "}),b.push({kind:"segment",field:"dayPeriod"}),f.push("dayPeriod"));let g={tokens:b,order:f};return Ga.set(o,g),g}let u={tokens:c,order:h};return Ga.set(o,u),u}function Vc(t){try{return new Intl.DateTimeFormat(t||"en",{hour:"numeric"}).resolvedOptions().hour12??!1}catch{return!1}}function Rr(t,e){try{let o=new Intl.DateTimeFormat(t||"en",{hour:"numeric",hour12:!0}),i=new Date(2026,0,1,e===0?9:15);return o.formatToParts(i).find(n=>n.type==="dayPeriod")?.value||(e===0?"AM":"PM")}catch{return e===0?"AM":"PM"}}function qc(t,e){return t==="hour"?e?{min:1,max:12}:{min:0,max:23}:t==="minute"||t==="second"?{min:0,max:59}:{min:0,max:1}}function nm(t,e,o,i,r=new Date){let s={...t},n=t[e];if(e==="dayPeriod"){let b=n??(r.getHours()<12?0:1);return s.dayPeriod=b===0?1:0,s}let{min:c,max:h}=qc(e,i);if(n==null){if(e==="hour"){let b=r.getHours();s.hour=i?b%12||12:b}else e==="minute"?s.minute=r.getMinutes():s.second=r.getSeconds();return s}let d=h-c+1,u=((n-c+o)%d+d)%d+c;return e==="hour"?s.hour=u:e==="minute"?s.minute=u:s.second=u,s}function lm(t,e,o,i){return/^[0-9]$/.test(o)?t==="dayPeriod"?{value:Za(e),buffer:e,advance:!1}:t==="hour"?i?Dr(e,o,1,12):Dr(e,o,0,23):Dr(e,o,0,59):{value:Za(e),buffer:e,advance:!1}}function Dr(t,e,o,i){let r=Number(e);if(t==="")return r===0&&o===0?{value:0,buffer:"0",advance:!1}:r===0?{value:null,buffer:"0",advance:!1}:r*10>i?{value:cm(r,o,i),buffer:"",advance:!0}:{value:r,buffer:e,advance:!1};let s=Number(t+e);return s>=o&&s<=i?{value:s,buffer:"",advance:!0}:t==="0"&&r===0?{value:o===0?0:null,buffer:"0",advance:!1}:Dr("",e,o,i)}function cm(t,e,o){return Math.min(o,Math.max(e,t))}function Za(t){if(!t)return null;let e=Number(t);return Number.isFinite(e)?e:null}function Wc(t){return t==="a"||t==="A"?0:t==="p"||t==="P"?1:null}function Nc(t,e,o,i,r){return t==="dayPeriod"?e==null?i:Rr(r,e):o?o.padStart(2,"0"):e==null?i:String(e).padStart(2,"0")}function hm(t,e){return!(t.hour==null||t.minute==null||e.withSeconds&&t.second==null||e.hour12&&t.dayPeriod==null)}function Hc(t){return t.hour==null&&t.minute==null&&t.second==null&&t.dayPeriod==null}function Uc(t,e){if(!hm(t,e))return"";let o=t.hour;if(e.hour12){let h=t.dayPeriod;o=o===12?h===0?0:12:h===1?o+12:o}if(o<0||o>23)return"";let i=t.minute;if(i<0||i>59)return"";let r=String(o).padStart(2,"0"),s=String(i).padStart(2,"0");if(!e.withSeconds)return`${r}:${s}`;let n=t.second;if(n<0||n>59)return"";let c=String(n).padStart(2,"0");return`${r}:${s}:${c}`}function Qa(t,e){let o={hour:null,minute:null,second:null,dayPeriod:null};if(!t)return o;let i=/^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(t);if(!i)return o;let r=Number(i[1]),s=Number(i[2]),n=i[3]!=null?Math.trunc(Number(i[3])):null;if(!Number.isFinite(r)||!Number.isFinite(s)||r<0||r>23||s<0||s>59||n!=null&&(n<0||n>59))return o;let c,h=null;return e.hour12?(h=r>=12?1:0,c=r%12||12):c=r,{hour:c,minute:s,second:e.withSeconds?n??0:null,dayPeriod:e.hour12?h:null}}function jc(t){return t==="any"?!0:!Number.isFinite(t)||t<=0?!1:t<60||t%60!==0}function Kc(t){let e=t.now??(()=>new Date);return{typeDigit:(o,i,r,s)=>{let n=lm(i,r,s,t.hour12()),h={...t.getSegments(o),[i]:n.value};return t.setSegments(o,h),n},step:(o,i,r)=>{let s=nm(t.getSegments(o),i,r,t.hour12(),e());return t.setSegments(o,s),{value:s[i]}},bounds:(o,i)=>qc(i,t.hour12()),commitBuffer:(o,i,r)=>{let s=Za(r),n=t.getSegments(o);return t.setSegments(o,{...n,[i]:s}),s},clear:(o,i)=>{let r=t.getSegments(o);return r[i]==null?!1:(t.setSegments(o,{...r,[i]:null}),!0)}}}var Xc=C`
  :host {
    --show-duration: var(--wa-transition-fast);
    --hide-duration: var(--wa-transition-fast);
    --column-item-height: 2.25em;
    --column-width: 3em;
  }

  :host(:state(disabled)) {
    cursor: not-allowed;
  }

  /* Popup */
  .time-input-popup {
    flex: 1 1 auto;
    display: inline-flex;
    width: 100%;
    position: relative;
    vertical-align: middle;
    --show-duration: inherit;
    --hide-duration: inherit;

    &::part(popup) {
      z-index: 900;
    }

    &[data-current-placement^='top']::part(popup) {
      transform-origin: bottom;
    }

    &[data-current-placement^='bottom']::part(popup) {
      transform-origin: top;
    }
  }

  /* Popup body — bordered card with the column listboxes. */
  .popup-body {
    display: inline-flex;
    flex-direction: column;
    background-color: var(--wa-color-surface-raised);
    border: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    box-shadow: var(--wa-shadow-m);
    color: var(--wa-color-text-normal);
    font-size: inherit;
    padding: var(--wa-space-2xs);
  }

  .columns {
    display: inline-flex;
    gap: var(--wa-space-2xs);
    align-items: stretch;
  }

  .column {
    display: flex;
    flex-direction: column;
    width: var(--column-width);
    max-height: calc(var(--column-item-height) * 7);
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
    /* Don't let column scroll bubble to the page. */
    overscroll-behavior: contain;
    outline: none;
    border-radius: var(--wa-border-radius-s);
  }

  .column::-webkit-scrollbar {
    display: none;
  }

  .column:focus-visible {
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) var(--wa-color-focus);
    outline-offset: 2px;
  }

  .column-item {
    flex: 0 0 var(--column-item-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    scroll-snap-align: center;
    border-radius: var(--wa-border-radius-s);
    color: var(--wa-color-text-normal);
    background: transparent;
    border: none;
    padding: 0;
    user-select: none;
    transition:
      background-color var(--wa-transition-fast),
      color var(--wa-transition-fast);
  }

  .column-item:hover:not([aria-disabled='true']):not([aria-selected='true']) {
    background-color: var(--wa-color-neutral-fill-quiet);
  }

  .column-item[aria-selected='true'] {
    background-color: var(--wa-color-brand-fill-loud);
    color: var(--wa-color-brand-on-loud);
  }

  .column-item[aria-disabled='true'] {
    color: var(--wa-color-text-quiet);
    cursor: not-allowed;
  }

  /* Footer / Now button */
  .popup-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--wa-space-xs);
    margin-top: var(--wa-space-xs);
    padding-top: var(--wa-space-xs);
    border-top: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
  }

  .now-button {
    appearance: none;
    background: transparent;
    border: var(--wa-border-style) var(--wa-border-width-s) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-s);
    padding: var(--wa-space-2xs) var(--wa-space-s);
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: background-color var(--wa-transition-fast);
  }

  .now-button:hover {
    background-color: var(--wa-color-neutral-fill-quiet);
  }

  .now-button:focus-visible {
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) var(--wa-color-focus);
    outline-offset: 2px;
  }

  /* Input wrapper */
  .input-wrapper {
    flex: 1;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    min-height: var(--wa-form-control-height);
    background-color: var(--wa-form-control-background-color);
    border-color: var(--wa-form-control-border-color);
    border-radius: var(--wa-form-control-border-radius);
    border-style: var(--wa-form-control-border-style);
    border-width: var(--wa-form-control-border-width);
    color: var(--wa-form-control-value-color);
    cursor: text;
    font-family: inherit;
    font-weight: var(--wa-form-control-value-font-weight);
    line-height: var(--wa-form-control-value-line-height);
    padding: 0 var(--wa-form-control-padding-inline);
    transition:
      background-color var(--wa-transition-normal),
      border-color var(--wa-transition-normal),
      outline-color var(--wa-transition-fast);
    transition-timing-function: var(--wa-transition-easing);
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) transparent;
    outline-offset: var(--wa-focus-ring-offset);
  }

  :host([pill]) .input-wrapper {
    border-radius: var(--wa-border-radius-pill);
  }

  :host(:focus-within) .input-wrapper {
    outline-color: var(--wa-color-focus);
  }

  :host(:state(disabled)) .input-wrapper {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Appearance variants */
  :host([appearance='filled']) .input-wrapper,
  :host([appearance='filled-outlined']) .input-wrapper {
    background-color: var(--wa-color-surface-lowered);
  }

  :host([appearance='filled']) .input-wrapper {
    border-color: transparent;
  }

  /* Segmented input — same patterns as wa-date-input. */
  .segments {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    caret-color: transparent;
  }

  .segment {
    display: inline-block;
    padding: 0 0.15em;
    margin: 0;
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: text;
    user-select: none;
    white-space: nowrap;
    border-radius: var(--wa-border-radius-s);
    transition:
      background-color var(--wa-transition-fast),
      color var(--wa-transition-fast);
  }

  .segment.empty {
    color: var(--wa-color-text-quiet);
  }

  /* Focus style — applies to keyboard *and* pointer focus so a click always shows the selection. Soft brand fill
     reads as "selected" without competing with the popup's loud selected items. */
  .segment:focus {
    background-color: var(--wa-color-brand-fill-quiet);
    color: var(--wa-color-brand-on-quiet);
    outline: none;
  }

  .segment.empty:focus {
    color: var(--wa-color-brand-on-quiet);
  }

  .segment-literal {
    display: inline-block;
    color: var(--wa-color-text-quiet);
    white-space: pre;
    user-select: none;
  }

  :host([disabled]) .segment,
  :host([readonly]) .segment {
    cursor: inherit;
  }

  /* Hidden form-value input (anchored under the wrapper for native validity tooltips). */
  .value-input {
    position: absolute;
    inset-inline-start: var(--wa-form-control-padding-inline);
    inset-block-start: 50%;
    transform: translateY(-50%);
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    border: none;
    padding: 0;
    margin: 0;
  }

  /* Trailing buttons (.clear-button, .expand-button), the .expand-icon box, and the start/end
     decoration slots are shared with <wa-date-input> via segmentedFieldStyles so both pickers
     stay on <wa-select>'s trailing optical axis. See segmented-field.styles.ts. */

  /* Animations */
  .time-input-popup::part(popup).show {
    animation: wa-time-input-show var(--show-duration) var(--wa-transition-easing);
  }

  .time-input-popup::part(popup).hide {
    animation: wa-time-input-hide var(--hide-duration) var(--wa-transition-easing);
  }

  @keyframes wa-time-input-show {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes wa-time-input-hide {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --show-duration: 0ms;
      --hide-duration: 0ms;
    }
    .column {
      scroll-behavior: auto;
    }
  }

  /* Visually hidden helper */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;var dm=["/",".","-",":",","," "],pm=class{constructor(t,e){this.buffers=new Map,this.active=null,this.handleFocus=o=>{let i=o.currentTarget,r=i.dataset.group,s=i.dataset.segment;this.active={group:r,field:s};for(let n of this.segmentElements())n.tabIndex=n===i?0:-1},this.handleBlur=o=>{let i=o.currentTarget,r=i.dataset.group,s=i.dataset.segment;this.getBuffer(r,s)&&this.flushBuffer(r,s)},this.handleKeyDown=o=>{let i=o.currentTarget??o.composedPath().find(c=>c instanceof HTMLElement&&c.dataset.group&&c.dataset.segment)??null;if(!i)return;let r=i.dataset.group,s=i.dataset.segment;if(!r||!s)return;if(o.key==="ArrowUp"||o.key==="ArrowDown"){if(o.preventDefault(),this.isReadonlyOrDisabled())return;this.getBuffer(r,s)&&this.flushBuffer(r,s);let c=o.key==="ArrowUp"?1:-1,h=this.config.rules.step(r,s,c);h&&this.config.onCommit?.(r,s,h.value);return}if(o.key==="ArrowLeft"||o.key==="ArrowRight"){o.preventDefault(),this.getBuffer(r,s)&&this.flushBuffer(r,s);let c=o.key==="ArrowLeft",h=this.config.isRtl()?!c:c;this.moveFocus(i,h?-1:1);return}if(o.key==="Home"){o.preventDefault(),this.segmentElements()[0]?.focus({preventScroll:!0});return}if(o.key==="End"){o.preventDefault();let c=this.segmentElements();c[c.length-1]?.focus({preventScroll:!0});return}if(o.key==="Tab"){this.getBuffer(r,s)&&this.flushBuffer(r,s);return}if(o.key==="Backspace"||o.key==="Delete"){if(o.preventDefault(),this.isReadonlyOrDisabled())return;this.getBuffer(r,s)?(this.setBuffer(r,s,""),this.config.onCommit?.(r,s,null)):this.config.rules.clear(r,s)?this.config.onCommit?.(r,s,null):o.key==="Backspace"&&this.moveFocus(i,-1);return}if(/^[0-9]$/.test(o.key)){if(o.preventDefault(),this.isReadonlyOrDisabled())return;let c=this.getBuffer(r,s),h=this.config.rules.typeDigit(r,s,c,o.key);this.setBuffer(r,s,h.buffer),this.config.onCommit?.(r,s,h.value),h.advance&&this.moveFocus(i,1);return}if((this.config.separatorKeys??dm).includes(o.key)){o.preventDefault(),this.getBuffer(r,s)&&this.flushBuffer(r,s),this.moveFocus(i,1);return}},this.host=t,this.config=e,t.addController(this)}hostConnected(){}hostDisconnected(){this.buffers.clear(),this.active=null}getBuffer(t,e){return this.buffers.get(this.key(t,e))??""}setBuffer(t,e,o){let i=this.key(t,e);o?this.buffers.set(i,o):this.buffers.delete(i)}clearBuffers(){this.buffers.clear()}getActiveSegment(){return this.active}setActiveSegment(t,e){this.active={group:t,field:e}}segmentElements(){let t=this.host.shadowRoot;return t?Array.from(t.querySelectorAll("[data-segment][data-group]")):[]}segmentElementFor(t,e){let o=this.host.shadowRoot;return o?o.querySelector(`[data-group="${t}"][data-segment="${e}"]`):null}findFocusableSegment(t){let e=this.segmentElements();return e.length===0?null:e.find(i=>{let r=i.dataset.group,s=i.dataset.segment;return t(r,s)&&!this.getBuffer(r,s)})??e[0]}focusActiveSegment(t){if(this.active){let e=this.segmentElementFor(this.active.group,this.active.field);if(e){e.focus({preventScroll:!0,...t});return}}this.segmentElements()[0]?.focus({preventScroll:!0,...t})}moveFocus(t,e,o){let i=this.segmentElements(),r=i.indexOf(t);if(r<0)return;let s=i[r+e];s&&s.focus({preventScroll:!0,...o})}flushBuffer(t,e){let o=this.getBuffer(t,e);if(!o)return!1;let i=this.config.rules.commitBuffer(t,e,o);return this.setBuffer(t,e,""),this.config.onCommit?.(t,e,i),!0}flushAllBuffers(){for(let[t,e]of this.buffers){if(!e)continue;let[o,i]=t.split(":"),r=this.config.rules.commitBuffer(o,i,e);this.config.onCommit?.(o,i,r)}this.buffers.clear()}eventHandlers(){return{keydown:this.handleKeyDown,focus:this.handleFocus,blur:this.handleBlur}}handleKeyDownEvent(t){let e=t.defaultPrevented;return this.handleKeyDown(t),t.defaultPrevented&&!e}key(t,e){return`${t}:${e}`}isReadonlyOrDisabled(){return!!(this.config.isReadonly?.()||this.config.isDisabled?.())}},um=C`
  /* font: inherit lifts the UA default button font-size so children that size with em
     (e.g. the expand icon) resolve against the host size-driven font-size instead of ~13px. */
  [part~='clear-button'],
  [part~='expand-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--wa-color-text-quiet);
    font: inherit;
    padding: 0.25em;
    /* Trailing padding overhangs the content edge rather than displacing the glyph. */
    margin-inline-end: -0.25em;
    border-radius: var(--wa-border-radius-s);
    transition: color var(--wa-transition-fast);
  }

  /* Fixed widths (= glyph + 2×0.25em padding) keep each glyph centered on the trailing axis
     regardless of the slotted icon's intrinsic width. */
  [part~='expand-button'] {
    inline-size: 1.75em;
    /* Leading gap that lands the clear button on <wa-select>'s clear axis. Scales with the
       form-control padding token (like select's own spacing) so it holds across themes; the
       0.125em offset accounts for the fixed button widths. */
    margin-inline-start: calc(var(--wa-form-control-padding-inline) - 0.125em);
  }

  [part~='clear-button'] {
    inline-size: 1.5em;
    margin-inline-start: var(--wa-form-control-padding-inline);
  }

  [part~='clear-button']:hover,
  [part~='expand-button']:hover {
    color: var(--wa-color-text-loud);
  }

  [part~='expand-button']:focus-visible {
    outline: var(--wa-focus-ring-style) var(--wa-focus-ring-width) var(--wa-color-focus);
    outline-offset: 2px;
  }

  /* font-size scales the glyph with the host size attribute; the button width handles centering. */
  [part~='expand-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--wa-color-text-quiet);
    font-size: 1.25em;
  }

  /* Start / end decoration slots. Spaced with the same --wa-form-control-padding-inline gap as
     <wa-input>/<wa-select> so slotted icons line up with the rest of the form controls, rather
     than the tighter 0.25em the pickers used before. */
  [part~='start'],
  [part~='end'] {
    display: inline-flex;
    align-items: center;
    color: var(--wa-color-text-quiet);
  }

  [part~='start']::slotted(*) {
    margin-inline-end: var(--wa-form-control-padding-inline);
  }

  [part~='end']::slotted(*) {
    margin-inline-start: var(--wa-form-control-padding-inline);
  }
`,mm=0,fm=()=>`wa-time-input-${++mm}`,Oi="single",at=class extends q{constructor(){super(...arguments),this.assumeInteractionOn=["input"],this.hasSlotController=new Z(this,"hint","label","footer"),this.localize=new I(this),this.popupId=fm(),this.keyboardHelpId=`${this.popupId}-help`,this.pendingValue=null,this.moveFocusToColumnOnShow=!1,this.lastEmittedValue="",this.segments={hour:null,minute:null,second:null,dayPeriod:null},this.segmentsController=new pm(this,{getLayout:()=>this.getLayout(),isRtl:()=>this.isRtl,isReadonly:()=>this.readonly,isDisabled:()=>this.disabled,rules:Kc({getSegments:()=>this.segments,setSegments:(t,e)=>{this.segments=e},hour12:()=>this.resolvedHour12}),onCommit:()=>{this.recomputeValue(),this.requestUpdate()}}),this.name="",this._value="",this.defaultValue=this.getAttribute("value")??"",this.disabled=!1,this.required=!1,this.readonly=!1,this.size="m",this.appearance="outlined",this.pill=!1,this.label="",this.hint="",this.autocomplete="",this.withClear=!1,this.withNow=!1,this.withLabel=!1,this.withHint=!1,this.min="",this.max="",this.step=60,this.hourFormat="auto",this.open=!1,this.placement="bottom-start",this.distance=0,this.handleDocumentFocusIn=t=>{t.composedPath().includes(this)||this.hide()},this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.open&&Dt(this)&&(t.stopPropagation(),t.preventDefault(),this.hide())},this.handleDocumentMouseDown=t=>{t.composedPath().includes(this)||this.hide()},this.handleSegmentFocus=t=>{this.segmentsController.eventHandlers().focus(t)},this.handleSegmentBlur=t=>{this.segmentsController.eventHandlers().blur(t)},this.handleInputWrapperPointerDown=t=>{if(!(this.disabled||this.readonly||this.open)){for(let e of t.composedPath()){if(e===this)break;if(!(e instanceof Element))continue;let o=e.tagName;if(o==="BUTTON"||o==="A"||e.getAttribute("role")==="button")return}this.show()}},this.handleSegmentKeyDown=t=>{let e=t.currentTarget,o=e.dataset.segment;if(t.altKey&&t.key==="ArrowDown"){t.preventDefault(),this.moveFocusToColumnOnShow=!0,this.open?this.focusFirstColumn():this.show();return}if(t.altKey&&t.key==="ArrowUp"){t.preventDefault(),this.hide();return}if(t.key==="Enter"){t.preventDefault(),this.segmentsController.getBuffer(Oi,o)&&(this.segmentsController.flushBuffer(Oi,o),this.recomputeValue()),this.open&&this.hide();return}if(o==="dayPeriod"){let i=Wc(t.key);if(i!=null){if(t.preventDefault(),this.readonly)return;this.segments={...this.segments,dayPeriod:i},this.recomputeValue(),this.requestUpdate(),this.segmentsController.moveFocus(e,1);return}}this.segmentsController.eventHandlers().keydown(t)},this.handleExpandButtonClick=()=>{this.open?this.hide():(this.moveFocusToColumnOnShow=!0,this.show())},this.handleClearClick=t=>{t.stopPropagation(),!(!this._value&&Hc(this.segments))&&(this._value="",this.valueHasChanged=!0,this.segmentsController.clearBuffers(),this.syncSegmentsFromCanonical(),this.updateValidity(),this.dispatchEvent(new co),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),this.lastEmittedValue="",this.focus())},this.handleClearMouseDown=t=>{t.preventDefault(),t.stopPropagation()},this.handleNowClick=()=>{let t=new Date;this.value=t,this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})),this.lastEmittedValue=this._value,this.hide()},this.handleColumnItemClick=t=>{let e=t.target.closest(".column-item");if(!e||e.getAttribute("aria-disabled")==="true")return;let o=e.dataset.field,i=Number(e.dataset.value);Number.isNaN(i)||(this.segments={...this.segments,[o]:i},this.recomputeValue(),this.requestUpdate())},this.handleColumnKeyDown=t=>{let e=t.currentTarget,o=e.dataset.field;if(t.key==="Escape"){t.preventDefault(),this.hide();return}if(t.key==="Enter"){t.preventDefault(),this.hide();return}if(t.key==="ArrowLeft"||t.key==="ArrowRight"){t.preventDefault();let i=this.columnFields;if(i.length<2)return;let r=t.key==="ArrowLeft"?-1:1,n=((i.indexOf(o)+r)%i.length+i.length)%i.length,c=i[n];this.shadowRoot?.querySelector(`.column[data-field="${c}"]`)?.focus({preventScroll:!0});return}if(t.key==="ArrowUp"||t.key==="ArrowDown"||t.key==="PageUp"||t.key==="PageDown"){t.preventDefault();let i=t.key==="ArrowUp"||t.key==="PageUp"?-1:1,r=t.key==="PageUp"||t.key==="PageDown"?5:1,s=this.columnItemsFor(o);if(s.length===0)return;let n=this.segments[o],h=(((n==null?0:Math.max(0,s.findIndex(u=>u.value===n)))+i*r)%s.length+s.length)%s.length,d=s[h];this.segments={...this.segments,[o]:d.value},this.recomputeValue(),this.requestUpdate(),requestAnimationFrame(()=>{let u=e.querySelector(`[data-value="${d.value}"]`);u&&this.keepItemInView(e,u)});return}if(t.key==="Home"){t.preventDefault();let i=this.columnItemsFor(o);if(i.length===0)return;this.segments={...this.segments,[o]:i[0].value},this.recomputeValue(),this.requestUpdate();return}if(t.key==="End"){t.preventDefault();let i=this.columnItemsFor(o);if(i.length===0)return;let r=i[i.length-1];this.segments={...this.segments,[o]:r.value},this.recomputeValue(),this.requestUpdate();return}}}static get validators(){let t=[oe({validationElement:Object.assign(document.createElement("input"),{required:!0})}),jt()];return[...super.validators,...t]}term(t,e){return this.localize.term(t)||e}get validationTarget(){return this.valueInput}get value(){return this.valueHasChanged?this._value:this._value||this.defaultValue||""}set value(t){let e=this.normalizeIncomingValue(t);if(e===this._value)return;let o=this._value;this._value=e,this.valueHasChanged=!0,this.hasUpdated?this.syncSegmentsFromCanonical():this.pendingValue=this._value,this.requestUpdate("value",o)}handleSizeChange(){U(this.localName,this.size)}disconnectedCallback(){super.disconnectedCallback(),this.removeOpenListeners()}firstUpdated(){this.pendingValue!=null?(this._value=this.pendingValue,this.pendingValue=null):!this._value&&this.defaultValue&&(this._value=this.defaultValue),this.syncSegmentsFromCanonical(),this.input=this.valueInput,this.updateValidity(),this.lastEmittedValue=this._value}updated(t){super.updated?.(t),t.has("value")&&this.customStates.set("blank",!this.value),t.has("disabled")&&this.customStates.set("disabled",this.disabled),t.has("open")&&this.customStates.set("open",this.open),(t.has("step")||t.has("hourFormat"))&&this.syncSegmentsFromCanonical(),(t.has("min")||t.has("max")||t.has("step"))&&this.updateValidity()}handleDisabledChange(){this.disabled&&this.open&&(this.open=!1)}async handleOpenChange(){if(this.open&&!this.disabled){let t=new Bt;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!1;return}this.addOpenListeners(),this.popup.active=!0,await this.updateComplete,await G(this.popup.popup,"show"),this.scrollColumnsToCurrent(),this.moveFocusToColumnOnShow&&(this.moveFocusToColumnOnShow=!1,this.focusFirstColumn()),this.dispatchEvent(new Vt)}else{let t=new Ft;if(this.dispatchEvent(t),t.defaultPrevented){this.open=!0;return}this.removeOpenListeners(),await G(this.popup.popup,"hide"),this.popup.active=!1,this.dispatchEvent(new qt);let e=this.shadowRoot?.activeElement;e&&this.popup?.contains(e)&&this.focusActiveSegment()}}focus(t){this.segmentsController.findFocusableSegment((o,i)=>this.segments[i]==null)?.focus(t)}blur(){this.shadowRoot?.activeElement?.blur()}async show(){this.open||this.disabled||(this.open=!0,await Ct(this,"wa-after-show"))}async hide(){!this.open||this.disabled||(this.open=!1,await Ct(this,"wa-after-hide"))}get valueAsDate(){let t=this.value;if(!t)return null;let e=Qa(t,{hour12:!1,withSeconds:this.resolvedWithSeconds});if(e.hour==null||e.minute==null)return null;let o=new Date;return o.setHours(e.hour,e.minute,e.second??0,0),o}get valueAsNumber(){let t=this.valueAsDate;return t?t.getHours()*36e5+t.getMinutes()*6e4+t.getSeconds()*1e3:Number.NaN}formResetCallback(){this._value=this.defaultValue,this.valueHasChanged=!1,this.segmentsController.clearBuffers(),this.syncSegmentsFromCanonical(),super.formResetCallback(),this.lastEmittedValue=this._value,this.requestUpdate()}formStateRestoreCallback(t){typeof t=="string"&&(this._value=t,this.hasUpdated?this.syncSegmentsFromCanonical():this.pendingValue=t,this.requestUpdate()),this.updateValidity()}get resolvedLocale(){return this.localize.lang()||"en"}get isRtl(){return this.localize.dir()==="rtl"}get resolvedHour12(){return this.hourFormat==="12"?!0:this.hourFormat==="24"?!1:Vc(this.resolvedLocale)}get resolvedWithSeconds(){return jc(this.step)}getLayout(){return Fc(this.resolvedLocale,{hour12:this.resolvedHour12,withSeconds:this.resolvedWithSeconds})}normalizeIncomingValue(t){if(t==null)return"";if(typeof t=="string")return t;if(t instanceof Date){let e=String(t.getHours()).padStart(2,"0"),o=String(t.getMinutes()).padStart(2,"0"),i=String(t.getSeconds()).padStart(2,"0");return this.resolvedWithSeconds?`${e}:${o}:${i}`:`${e}:${o}`}return""}syncSegmentsFromCanonical(){this.segmentsController.clearBuffers(),this.segments=Qa(this._value,{hour12:this.resolvedHour12,withSeconds:this.resolvedWithSeconds}),this.updateHiddenInput()}updateHiddenInput(){this.valueInput&&(this.valueInput.value=this._value),this.setValue(this._value||null)}recomputeValue(){let t=this._value,e=Uc(this.segments,{hour12:this.resolvedHour12,withSeconds:this.resolvedWithSeconds});e!==t&&(this._value=e,this.valueHasChanged=!0,this.updateHiddenInput(),this.updateValidity()),this.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0})),e!==this.lastEmittedValue&&(this.lastEmittedValue=e,this.dispatchEvent(new Event("change",{bubbles:!0,composed:!0})))}addOpenListeners(){document.addEventListener("focusin",this.handleDocumentFocusIn),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown),Kt(this)}removeOpenListeners(){document.removeEventListener("focusin",this.handleDocumentFocusIn),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),It(this)}focusActiveSegment(){let t=this.segmentsController.getActiveSegment();if(t){let e=this.segmentsController.segmentElementFor(t.group,t.field);if(e){e.focus({preventScroll:!0});return}}this.segmentsController.findFocusableSegment((e,o)=>this.segments[o]==null)?.focus({preventScroll:!0})}get columnFields(){return this.getLayout().order.filter(t=>t!==void 0)}columnItemsFor(t){if(t==="dayPeriod")return[{label:this.term("am",Rr(this.resolvedLocale,0)),value:0,disabled:!1},{label:this.term("pm",Rr(this.resolvedLocale,1)),value:1,disabled:!1}];if(t==="hour"){let r=[];if(this.resolvedHour12)for(let s=1;s<=12;s++)r.push({label:String(s).padStart(2,"0"),value:s,disabled:!1});else for(let s=0;s<=23;s++)r.push({label:String(s).padStart(2,"0"),value:s,disabled:!1});return r}let e=typeof this.step=="number"&&Number.isFinite(this.step)&&this.step>0?this.step:1,o=t==="minute"?e<60?1:Math.max(1,Math.floor(e/60)):Math.max(1,Math.floor(e)),i=[];for(let r=0;r<60;r+=o)i.push({label:String(r).padStart(2,"0"),value:r,disabled:!1});return i}focusFirstColumn(){if(!this.shadowRoot)return;this.shadowRoot.querySelector(".column")?.focus({preventScroll:!0})}scrollColumnsToCurrent(){if(this.shadowRoot)for(let t of this.shadowRoot.querySelectorAll(".column")){let e=t.dataset.field,o=this.segments[e];if(o==null)continue;let i=t.querySelector(`[data-value="${o}"]`);i&&this.keepItemInView(t,i)}}keepItemInView(t,e){let o=t.getBoundingClientRect(),i=e.getBoundingClientRect();i.top<o.top?t.scrollTop+=i.top-o.top:i.bottom>o.bottom&&(t.scrollTop+=i.bottom-o.bottom)}placeholderFor(t){return"--"}fieldLabelFor(t){let e=t==="hour"?"Hour":t==="minute"?"Minute":t==="second"?"Second":"AM/PM";return this.term(t,e)}segmentAriaValueText(t){let e=this.segments[t],o=this.segmentsController.getBuffer(Oi,t);return o||(e==null?this.term("empty","Empty"):t==="dayPeriod"?e===0?this.term("am","AM"):this.term("pm","PM"):String(e))}render(){let t=this.hasUpdated?this.hasSlotController.test("label"):this.withLabel,e=this.hasUpdated?this.hasSlotController.test("hint"):this.withHint,o=this.hasUpdated?this.hasSlotController.test("footer"):!1,i=!!this.label||!!t,r=!!this.hint||!!e,s=!!this._value,n=this.getLayout(),c=this.label||this.term("time","Time");return p`
      <div
        part="form-control"
        class=${_({"form-control":!0,"form-control-has-label":i})}
      >
        <label
          id="label"
          part="form-control-label label"
          class=${_({label:!0,"has-label":i})}
          aria-hidden=${i?"false":"true"}
          @click=${()=>this.focus()}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <wa-popup
            class=${_({"time-input-popup":!0,open:this.open})}
            placement=${this.placement}
            distance=${this.distance}
            ?active=${this.open}
            flip
            shift
          >
            <div
              part="base time-input input-wrapper"
              class="input-wrapper"
              slot="anchor"
              @pointerdown=${this.handleInputWrapperPointerDown}
            >
              <slot name="start" part="start" class="start"></slot>

              <div
                part="input"
                class="segments"
                role="group"
                aria-labelledby=${i?"label":lt}
                aria-label=${i?lt:c}
              >
                ${this.renderSegmentGroup(n)}
              </div>

              <span id=${this.keyboardHelpId} class="visually-hidden">
                ${this.term("timeInputKeyboardHelp","Use arrow keys to change values; press Alt+Down Arrow to open the time picker.")}
              </span>

              <input
                class="value-input"
                type="time"
                tabindex="-1"
                aria-hidden="true"
                .value=${this._value}
                min=${M(this.min||void 0)}
                max=${M(this.max||void 0)}
                step=${M(this.step==="any"?"any":String(this.step))}
                ?disabled=${this.disabled}
                ?required=${this.required}
                autocomplete=${M(this.autocomplete||void 0)}
              />

              ${this.withClear&&s?p`<button
                    part="clear-button"
                    type="button"
                    class="clear-button"
                    aria-label=${this.localize.term("clearEntry")}
                    tabindex="-1"
                    @mousedown=${this.handleClearMouseDown}
                    @click=${this.handleClearClick}
                  >
                    <slot name="clear-icon">
                      <wa-icon name="circle-xmark" library="system" variant="regular"></wa-icon>
                    </slot>
                  </button>`:lt}

              <slot name="end" part="end" class="end"></slot>

              <button
                part="expand-button"
                type="button"
                class="expand-button"
                aria-label=${this.open?this.term("closeTimeInput","Close time picker"):this.term("chooseTime","Choose time")}
                aria-haspopup="dialog"
                aria-expanded=${this.open?"true":"false"}
                aria-controls=${this.popupId}
                ?disabled=${this.disabled}
                @click=${this.handleExpandButtonClick}
              >
                <slot name="expand-icon" part="expand-icon" class="expand-icon">
                  <wa-icon library="system" name="clock"></wa-icon>
                </slot>
              </button>
            </div>

            <div
              id=${this.popupId}
              part="popup"
              class="popup-body"
              role="dialog"
              aria-modal="true"
              aria-label=${this.term("chooseTime","Choose time")}
            >
              <div part="columns" class="columns">${this.columnFields.map(h=>this.renderColumn(h))}</div>
              ${o?p`<div class="popup-footer"><slot name="footer"></slot></div>`:this.withNow?p`<div class="popup-footer">
                      <button part="now-button" type="button" class="now-button" @click=${this.handleNowClick}>
                        ${this.term("now","Now")}
                      </button>
                    </div>`:lt}
            </div>
          </wa-popup>
        </div>

        <slot
          id="hint"
          name="hint"
          part="hint"
          class=${_({"has-slotted":r})}
          aria-hidden=${r?"false":"true"}
        >
          ${this.hint}
        </slot>
      </div>
    `}renderSegmentGroup(t){let e=this.segmentsController.getActiveSegment(),o=!1,i=[];for(let r of t.tokens)if(r.kind==="literal")i.push(p`<span part="segment-literal" class="segment-literal" aria-hidden="true">${r.text}</span>`);else{let s=r.field,n=!o&&(e==null||e.field===s);n&&(o=!0),i.push(this.renderSegment(s,n))}return i}renderSegment(t,e){let o=this.segments[t],i=this.segmentsController.getBuffer(Oi,t),r=this.placeholderFor(t),s=Nc(t,o,i,r,this.resolvedLocale),n=o==null&&!i,c=t==="hour"?this.resolvedHour12?{min:1,max:12}:{min:0,max:23}:t==="minute"||t==="second"?{min:0,max:59}:{min:0,max:1},h=this.segmentAriaValueText(t);return p`<span
      part="segment"
      class=${_({segment:!0,empty:n,[`segment-${t}`]:!0})}
      data-group=${Oi}
      data-segment=${t}
      role="spinbutton"
      tabindex=${this.disabled?-1:e?0:-1}
      aria-label=${this.fieldLabelFor(t)}
      aria-valuemin=${c.min}
      aria-valuemax=${c.max}
      aria-valuenow=${M(o??void 0)}
      aria-valuetext=${h}
      aria-readonly=${this.readonly?"true":"false"}
      aria-disabled=${this.disabled?"true":"false"}
      aria-describedby=${this.keyboardHelpId}
      inputmode=${t==="dayPeriod"?"text":"numeric"}
      @keydown=${this.handleSegmentKeyDown}
      @focus=${this.handleSegmentFocus}
      @blur=${this.handleSegmentBlur}
      >${s}</span
    >`}renderColumn(t){let e=this.columnItemsFor(t),o=this.segments[t],i=o!=null?`${this.popupId}-${t}-${o}`:void 0;return p`<div
      part="column column-${t}"
      class=${_({column:!0,[`column-${t}`]:!0})}
      data-field=${t}
      role="listbox"
      tabindex="0"
      aria-label=${this.fieldLabelFor(t)}
      aria-orientation="vertical"
      aria-activedescendant=${M(i)}
      @click=${this.handleColumnItemClick}
      @keydown=${this.handleColumnKeyDown}
    >
      ${e.map(r=>{let s=`${this.popupId}-${t}-${r.value}`,n=r.value===o;return p`<button
          id=${s}
          part="column-item ${n?"column-item-selected":""}"
          class="column-item"
          data-field=${t}
          data-value=${r.value}
          type="button"
          role="option"
          aria-selected=${n?"true":"false"}
          aria-disabled=${r.disabled?"true":"false"}
          tabindex="-1"
        >
          ${r.label}
        </button>`})}
    </div>`}};at.css=[j,pt,um,Xc];at.shadowRootOptions={...q.shadowRootOptions,delegatesFocus:!0};a([S(".time-input-popup")],at.prototype,"popup",2);a([S(".value-input")],at.prototype,"valueInput",2);a([A()],at.prototype,"segments",2);a([l({reflect:!0})],at.prototype,"name",2);a([A()],at.prototype,"value",1);a([l({attribute:"value",reflect:!0})],at.prototype,"defaultValue",2);a([l({type:Boolean})],at.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],at.prototype,"required",2);a([l({type:Boolean,reflect:!0})],at.prototype,"readonly",2);a([l({reflect:!0})],at.prototype,"size",2);a([y("size")],at.prototype,"handleSizeChange",1);a([l({reflect:!0})],at.prototype,"appearance",2);a([l({type:Boolean,reflect:!0})],at.prototype,"pill",2);a([l()],at.prototype,"label",2);a([l({attribute:"hint"})],at.prototype,"hint",2);a([l()],at.prototype,"autocomplete",2);a([l({attribute:"with-clear",type:Boolean})],at.prototype,"withClear",2);a([l({attribute:"with-now",type:Boolean})],at.prototype,"withNow",2);a([l({attribute:"with-label",type:Boolean})],at.prototype,"withLabel",2);a([l({attribute:"with-hint",type:Boolean})],at.prototype,"withHint",2);a([l({reflect:!0})],at.prototype,"min",2);a([l({reflect:!0})],at.prototype,"max",2);a([l({converter:{fromAttribute:gm,toAttribute:bm}})],at.prototype,"step",2);a([l({attribute:"hour-format",reflect:!0})],at.prototype,"hourFormat",2);a([l({type:Boolean,reflect:!0})],at.prototype,"open",2);a([l({reflect:!0})],at.prototype,"placement",2);a([l({type:Number,reflect:!0})],at.prototype,"distance",2);a([y("disabled",{waitUntilFirstUpdate:!0})],at.prototype,"handleDisabledChange",1);a([y("open",{waitUntilFirstUpdate:!0})],at.prototype,"handleOpenChange",1);at=a([k("wa-time-input")],at);function gm(t){if(t==null)return 60;if(t==="any")return"any";let e=Number(t);return Number.isFinite(e)&&e>0?e:60}function bm(t){return t==="any"?"any":String(t)}var Yc=C`
  :host {
    --gap: var(--wa-space-s);
    --width: 28rem;
    --reorder-duration: var(--wa-transition-normal);

    display: flex;
    flex-direction: column;
    position: fixed;
    width: var(--width);
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    padding: var(--wa-space-m);
    overflow-y: auto;
    gap: var(--gap);
    border: none;
    background: transparent;
    pointer-events: none;
    scrollbar-width: thin;

    /* Reset inset properties so placement changes work correctly */
    inset-block-start: auto;
    inset-block-end: auto;
    inset-inline-start: auto;
    inset-inline-end: auto;
    translate: none;
    align-content: normal;
    justify-content: normal;
  }

  :host(:not(:popover-open)) {
    display: none;
  }

  /* Placement positioning using logical properties for RTL support */
  :host([placement='top-start']) {
    inset-block-start: 0;
    inset-inline-start: 0;
  }

  :host([placement='top-center']) {
    inset-block-start: 0;
    inset-inline-start: 50%;
    translate: -50% 0;
  }

  :host([placement='top-end']) {
    inset-block-start: 0;
    inset-inline-start: auto;
    inset-inline-end: 0;
  }

  :host([placement='bottom-start']) {
    inset-block-end: 0;
    inset-inline-start: 0;
    align-content: end;
  }

  :host([placement='bottom-center']) {
    inset-block-end: 0;
    inset-inline-start: 50%;
    translate: -50% 0;
    align-content: end;
  }

  :host([placement='bottom-end']) {
    inset-block-end: 0;
    inset-inline-start: auto;
    inset-inline-end: 0;
    align-content: end;
  }

  /* Bottom placements: justify content to end */
  :host([placement^='bottom']) {
    justify-content: end;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    width: 100%;
    pointer-events: auto;
  }

  /* Bottom placements: reverse stack order so newest appears at bottom */
  :host([placement^='bottom']) .stack {
    flex-direction: column-reverse;
  }

  /* Mobile: full width */
  @media (max-width: 480px) {
    :host {
      width: 100%;
      padding: var(--wa-space-s);
    }

    :host([placement='top-center']),
    :host([placement='bottom-center']) {
      translate: 0;
    }
  }
`;var Bi=null,Pr=0;function vm(){if(Pr+=1,Bi||typeof document>"u")return;let t=document.createElement("div");t.id=ee("wa-toast-live-region-"),t.setAttribute("data-wa-toast-live-region",""),t.style.cssText=`
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
    pointer-events: none;
    top: 0;
    left: 0;
  `,document.body.append(t),Bi=t}function wm(){Pr=Math.max(0,Pr-1),!(Pr>0)&&(Bi?.remove(),Bi=null)}function ym(t,e){if(typeof document>"u")return;let o=Bi;if(!o)return;let i=t.trim();if(!i)return;let r=document.createElement("div");r.setAttribute("role",e==="danger"?"alert":"status"),r.setAttribute("aria-live",e==="danger"?"assertive":"polite"),r.setAttribute("aria-atomic","true"),o.append(r),requestAnimationFrame(()=>{requestAnimationFrame(()=>{r.textContent=i})}),setTimeout(()=>r.remove(),1e3)}var ri=class extends E{constructor(){super(...arguments),this.activatedToastItems=new WeakSet,this.positionCache=new Map,this.placement="top-end",this.handleDocumentKeyDown=async t=>{if(await new Promise(e=>setTimeout(e)),t.key==="Escape"&&!t.defaultPrevented){let e=this.getToastItems();e.length>0&&(t.preventDefault(),e[e.length-1]?.hide())}},this.handleAfterHide=async t=>{let e=t.target;e.parentElement===this&&(this.capturePositions(),e.remove(),await this.animatePositions()),this.getToastItems().length===0&&this.hideStack()}}connectedCallback(){super.connectedCallback(),this.popover="manual",vm(),document.addEventListener("keydown",this.handleDocumentKeyDown)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener?.("keydown",this.handleDocumentKeyDown),wm()}handleSlotChange(){let t=this.getToastItems(),e=[];t.forEach(o=>{this.activatedToastItems.has(o)||e.push(o)}),e.length>0&&(this.capturePositions(),e.forEach(o=>{this.activatedToastItems.add(o),this.showStack(),o.startTimer(),this.announceToastItem(o)}),requestAnimationFrame(()=>this.animatePositions()))}announceToastItem(t){ym(t.textContent??"",t.variant)}getToastItems(){return[...this.querySelectorAll(":scope > wa-toast-item")]}capturePositions(){this.positionCache.clear();for(let t of this.getToastItems())this.positionCache.set(t,t.getBoundingClientRect())}async animatePositions(){if($o()){this.positionCache.clear();return}let t=[];for(let e of this.getToastItems()){let o=this.positionCache.get(e);if(!o)continue;let i=e.getBoundingClientRect(),r=o.top-i.top;if(Math.abs(r)>1){let s=ke(e,[{transform:`translateY(${r}px)`},{transform:"translateY(0)"}],{duration:200,easing:"cubic-bezier(0.2, 0, 0, 1)"});t.push(s)}}this.positionCache.clear(),await Promise.all(t)}showStack(){this.matches(":popover-open")||(this.showPopover(),this.customStates.set("visible",!0))}hideStack(){this.matches(":popover-open")&&(this.hidePopover(),this.customStates.set("visible",!1))}async create(t,e){let o={allowHtml:!1,duration:5e3,variant:"neutral",size:"m",...e},i=document.createElement("wa-toast-item");if(i.variant=o.variant,i.size=o.size,i.duration=o.duration,o.allowHtml?i.innerHTML=t:i.textContent=t,o.icon){let r=document.createElement("wa-icon");r.setAttribute("slot","icon"),typeof o.icon=="string"?r.setAttribute("name",o.icon):(r.setAttribute("name",o.icon.name),o.icon.library&&r.setAttribute("library",o.icon.library),o.icon.family&&r.setAttribute("family",o.icon.family),o.icon.variant&&r.setAttribute("variant",o.icon.variant)),i.prepend(r)}return this.activatedToastItems.add(i),this.capturePositions(),this.showStack(),this.prepend(i),await i.updateComplete,this.animatePositions(),i.startTimer(),this.announceToastItem(i),i}render(){return p`
      <div part="stack" class="stack" @wa-after-hide=${this.handleAfterHide}>
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `}};ri.css=Yc;a([S(".stack")],ri.prototype,"stack",2);a([l({reflect:!0})],ri.prototype,"placement",2);ri=a([k("wa-toast")],ri);var Gc=C`
  :host {
    --accent-width: 4px;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);
    --accent-color: var(--wa-color-fill-loud);

    display: block;
    pointer-events: auto;
  }

  /* Sizes */
  :host([size='xs']) {
    --padding: var(--wa-space-xs);
  }
  :host([size='s']),
  :host([size='small']) {
    --padding: var(--wa-space-s);
  }
  :host([size='m']),
  :host([size='medium']) {
    --padding: var(--wa-space-m);
  }
  :host([size='l']),
  :host([size='large']) {
    --padding: var(--wa-space-l);
  }
  :host([size='xl']) {
    --padding: var(--wa-space-xl);
  }

  .toast-item {
    display: flex;
    align-items: stretch;
    background: var(--wa-color-surface-raised);
    border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    box-shadow: var(--wa-shadow-l);
    overflow: hidden;
  }

  /* Animations */
  .toast-item.show {
    animation: toast-show var(--show-duration) var(--wa-transition-easing) forwards;
  }

  .toast-item.hide {
    animation: toast-hide var(--hide-duration) var(--wa-transition-easing) forwards;
  }

  @keyframes toast-show {
    from {
      opacity: 0;
      translate: 0 -0.5rem;
    }
    to {
      opacity: 1;
      translate: 0;
    }
  }

  @keyframes toast-hide {
    from {
      opacity: 1;
      translate: 0;
    }
    to {
      opacity: 0;
      translate: 0 -0.5rem;
    }
  }

  /* Accent line */
  .accent {
    flex: 0 0 auto;
    width: var(--accent-width);
    background: var(--accent-color);
  }

  /* Icon - only show if slot has content */
  .icon {
    display: flex;
    align-items: center;
    padding: var(--padding);
    padding-inline-end: 0;
    color: var(--accent-color);
    font-size: 1.25em;
  }

  .toast-item:not(.toast-item--has-icon) .icon {
    display: none;
  }

  /* Content */
  .content {
    flex: 1 1 auto;
    align-self: center;
    min-width: 0;
    padding: var(--padding);
    color: var(--wa-color-text-normal);
  }

  /* Close button */
  .close-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    padding-inline: var(--padding);
    background: transparent;
    border: none;
    border-start-end-radius: var(--border-radius);
    border-end-end-radius: var(--border-radius);
    color: var(--wa-color-neutral-on-quiet);
    font-size: inherit;
    cursor: pointer;
    transition: background-color var(--wa-transition-fast);

    @media (hover: hover) {
      &:hover {
        color: color-mix(in oklab, currentColor, var(--wa-color-mix-hover));
      }
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--wa-focus-ring);
      outline-offset: calc(var(--wa-focus-ring-width) * -1);
    }
  }

  /* Progress ring styling */
  wa-progress-ring {
    --size: var(--wa-form-control-height);
    --track-width: 0.125rem;
    --indicator-width: 0.125rem;
    --track-color: var(--wa-color-neutral-fill-quiet);
    --indicator-color: var(--accent-color);
    --indicator-transition-duration: 50ms;
  }

  /* Hide progress ring indicator when no duration */
  .toast-item:not(.toast-item--has-duration) wa-progress-ring {
    --track-color: transparent;
    --indicator-color: transparent;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .toast-item.show,
    .toast-item.hide {
      animation: none;
    }
  }
`;var _e=class extends E{constructor(){super(...arguments),this.hasSlotController=new Z(this,"icon"),this.localize=new I(this),this.animationFrame=null,this.startTime=null,this.isHovering=!1,this.isFocused=!1,this.timeLeft=100,this.variant="neutral",this.size="m",this.duration=5e3,this.withIcon=!1,this.tick=()=>{if(!this.startTime)return;let t=performance.now()-this.startTime,e=Math.min(t/this.duration,1);this.timeLeft=100*(1-e),e<1?this.animationFrame=requestAnimationFrame(this.tick):this.hide()},this.handlePointerEnter=t=>{(t.pointerType==="mouse"||t.pointerType==="pen")&&(this.isHovering=!0,this.pauseTimer())},this.handlePointerLeave=()=>{this.isHovering&&(this.isHovering=!1,this.resumeTimer())},this.handleFocusIn=()=>{this.isFocused=!0,this.pauseTimer()},this.handleFocusOut=()=>{this.isFocused=!1,this.resumeTimer()}}handleSizeChange(){U(this.localName,this.size)}connectedCallback(){super.connectedCallback(),this.addEventListener("pointerenter",this.handlePointerEnter),this.addEventListener("pointerleave",this.handlePointerLeave)}disconnectedCallback(){super.disconnectedCallback(),this.stopTimer(),this.removeEventListener("pointerenter",this.handlePointerEnter),this.removeEventListener("pointerleave",this.handlePointerLeave)}async startTimer(){let t=new Bt;this.dispatchEvent(t),!t.defaultPrevented&&(await this.updateComplete,await G(this.toastItemElement,"show"),this.dispatchEvent(new Vt),this.duration>0&&Number.isFinite(this.duration)&&(this.startTime=performance.now(),this.timeLeft=100,this.tick()))}stopTimer(){this.animationFrame!==null&&(cancelAnimationFrame(this.animationFrame),this.animationFrame=null)}async hide(){this.stopTimer();let t=new Ft;this.dispatchEvent(t),!t.defaultPrevented&&(await G(this.toastItemElement,"hide"),this.dispatchEvent(new qt),this.remove())}handleCloseClick(){this.hide()}pauseTimer(){this.stopTimer(),this.timeLeft=100}resumeTimer(){!this.isHovering&&!this.isFocused&&this.duration>0&&(this.startTime=performance.now(),this.tick())}render(){let t=this.hasUpdated?this.hasSlotController.test("icon"):this.withIcon,e=this.duration>0;return p`
      <div
        part="toast-item"
        class=${_({"toast-item":!0,"toast-item--has-icon":t,"toast-item--has-duration":e})}
      >
        <div part="accent" class="accent"></div>

        <div part="icon" class="icon">
          <slot name="icon"></slot>
        </div>

        <div part="content" class="content">
          <slot></slot>
        </div>

        <button
          part="close-button"
          class="close-button"
          type="button"
          aria-label=${this.localize.term("close")}
          @click=${this.handleCloseClick}
          @focusin=${this.handleFocusIn}
          @focusout=${this.handleFocusOut}
        >
          <wa-progress-ring
            part="progress-ring"
            exportparts="
              base:progress-ring__base,
              label:progress-ring__label,
              track:progress-ring__track,
              indicator:progress-ring__indicator
            "
            value=${this.timeLeft}
            aria-hidden="true"
          >
            <wa-icon
              part="close-icon"
              exportparts="svg:close-icon__svg"
              name="xmark"
              library="system"
              variant="solid"
            ></wa-icon>
          </wa-progress-ring>
        </button>
      </div>
    `}};_e.css=[Gc,De,j];a([S(".toast-item")],_e.prototype,"toastItemElement",2);a([A()],_e.prototype,"timeLeft",2);a([l({reflect:!0})],_e.prototype,"variant",2);a([l({reflect:!0})],_e.prototype,"size",2);a([y("size")],_e.prototype,"handleSizeChange",1);a([l({type:Number})],_e.prototype,"duration",2);a([l({attribute:"with-icon",type:Boolean})],_e.prototype,"withIcon",2);_e=a([k("wa-toast-item")],_e);var Zc=class extends Event{constructor(t){super("wa-selection-change",{bubbles:!0,cancelable:!1,composed:!0}),this.detail=t}};var Qc=class extends Event{constructor(){super("wa-lazy-change",{bubbles:!0,cancelable:!1,composed:!0})}};var Jc=class extends Event{constructor(){super("wa-lazy-load",{bubbles:!0,cancelable:!1,composed:!0})}};var th=class extends Event{constructor(){super("wa-expand",{bubbles:!0,cancelable:!1,composed:!0})}};var eh=class extends Event{constructor(){super("wa-collapse",{bubbles:!0,cancelable:!1,composed:!0})}};var oh=class extends Event{constructor(){super("wa-after-collapse",{bubbles:!0,cancelable:!1,composed:!0})}};var ih=class extends Event{constructor(){super("wa-after-expand",{bubbles:!0,cancelable:!1,composed:!0})}};var rh=C`
  :host {
    /* Private - set by the component to control indentation depth */
    --indent: 0px;
    --show-duration: var(--wa-transition-normal);
    --hide-duration: var(--wa-transition-normal);

    display: block;
    color: var(--wa-color-text-normal);
    outline: 0;
    z-index: 0;
  }

  :host(:focus) {
    outline: none;
  }

  slot:not([name])::slotted(wa-icon) {
    margin-inline-end: 0.5em;
  }

  .tree-item {
    position: relative;
    display: flex;
    align-items: stretch;
    flex-direction: column;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }

  .checkbox {
    line-height: var(--wa-form-control-value-line-height);
    pointer-events: none;
  }

  .expand-button,
  .checkbox,
  .label {
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
  }

  .checkbox::part(base) {
    display: flex;
    align-items: center;
  }

  .indentation {
    display: block;
    width: var(--indent);
    flex-shrink: 0;
  }

  .expand-button {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--wa-color-text-quiet);
    width: 2em;
    height: 2em;
    flex-shrink: 0;
    cursor: pointer;
  }

  .expand-button {
    transition: rotate var(--wa-transition-normal) var(--wa-transition-easing);
  }

  .tree-item-expanded .expand-button {
    rotate: 90deg;
  }

  .tree-item-expanded:dir(rtl) .expand-button {
    rotate: -90deg;
  }

  .tree-item-expanded:not(.tree-item-loading) slot[name='expand-icon'],
  .tree-item:not(.tree-item-expanded) slot[name='collapse-icon'] {
    display: none;
  }

  .tree-item:not(.tree-item-has-expand-button):not(.tree-item-loading) .expand-icon-slot {
    display: none;
  }

  .tree-item:not(.tree-item-has-expand-button):not(.tree-item-loading) .expand-button {
    cursor: default;
  }

  .tree-item-loading .expand-icon-slot wa-icon {
    display: none;
  }

  .expand-button-visible {
    cursor: pointer;
  }

  .item {
    display: flex;
    align-items: center;
    border-inline-start: solid 0.1875em transparent;
  }

  :host([disabled]) .item {
    opacity: 0.5;
    outline: none;
    cursor: not-allowed;
  }

  :host(:focus-visible) .item {
    outline: var(--wa-focus-ring);
    outline-offset: var(--wa-focus-ring-offset);
    z-index: 2;
  }

  :host(:not([aria-disabled='true'])) .tree-item-selected .item {
    background-color: var(--wa-color-neutral-fill-quiet);
    border-inline-start-color: var(--wa-color-brand-fill-loud);
  }

  :host(:not([aria-disabled='true'])) .expand-button {
    color: var(--wa-color-text-quiet);
  }

  .label {
    display: flex;
    align-items: center;
    transition: color var(--wa-transition-normal) var(--wa-transition-easing);
  }

  .children {
    display: block;
  }

  /* Indentation lines */
  .children {
    position: relative;
  }

  .children::before {
    content: '';
    position: absolute;
    top: var(--indent-guide-offset);
    bottom: var(--indent-guide-offset);
    inset-inline-start: calc(0.1875em + var(--indent) + 1em - (var(--indent-guide-width) / 2));
    border-inline-end: var(--indent-guide-width) var(--indent-guide-style) var(--indent-guide-color);
    z-index: 1;
  }

  @media (forced-colors: active) {
    :host(:not([aria-disabled='true'])) .tree-item-selected .item {
      outline: dashed 1px SelectedItem;
    }
  }
`;var xo=class extends Event{constructor(e,o,i,r){super("context-request",{bubbles:!0,composed:!0}),this.context=e,this.contextTarget=o,this.callback=i,this.subscribe=r??!1}};var ai=class{constructor(e,o,i,r){if(this.subscribe=!1,this.provided=!1,this.value=void 0,this.t=(s,n)=>{this.unsubscribe&&(this.unsubscribe!==n&&(this.provided=!1,this.unsubscribe()),this.subscribe||this.unsubscribe()),this.value=s,this.host.requestUpdate(),this.provided&&!this.subscribe||(this.provided=!0,this.callback&&this.callback(s,n)),this.unsubscribe=n},this.host=e,o.context!==void 0){let s=o;this.context=s.context,this.callback=s.callback,this.subscribe=s.subscribe??!1}else this.context=o,this.callback=i,this.subscribe=r??!1;this.host.addController(this)}hostConnected(){this.dispatchRequest()}hostDisconnected(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=void 0)}dispatchRequest(){this.host.dispatchEvent(new xo(this.context,this.host,this.t,this.subscribe))}};var Or=class{get value(){return this.o}set value(e){this.setValue(e)}setValue(e,o=!1){let i=o||!Object.is(e,this.o);this.o=e,i&&this.updateObservers()}constructor(e){this.subscriptions=new Map,this.updateObservers=()=>{for(let[o,{disposer:i}]of this.subscriptions)o(this.o,i)},e!==void 0&&(this.value=e)}addCallback(e,o,i){if(!i)return void e(this.value);this.subscriptions.has(e)||this.subscriptions.set(e,{disposer:()=>{this.subscriptions.delete(e)},consumerHost:o});let{disposer:r}=this.subscriptions.get(e);e(this.value,r)}clearCallbacks(){this.subscriptions.clear()}};var Ja=class extends Event{constructor(e,o){super("context-provider",{bubbles:!0,composed:!0}),this.context=e,this.contextTarget=o}},si=class extends Or{constructor(e,o,i){super(o.context!==void 0?o.initialValue:i),this.onContextRequest=r=>{if(r.context!==this.context)return;let s=r.contextTarget??r.composedPath()[0];s!==this.host&&(r.stopPropagation(),this.addCallback(r.callback,s,r.subscribe))},this.onProviderRequest=r=>{if(r.context!==this.context||(r.contextTarget??r.composedPath()[0])===this.host)return;let s=new Set;for(let[n,{consumerHost:c}]of this.subscriptions)s.has(n)||(s.add(n),c.dispatchEvent(new xo(this.context,c,n,!0)));r.stopPropagation()},this.host=e,o.context!==void 0?this.context=o.context:this.context=o,this.attachListeners(),this.host.addController?.(this)}attachListeners(){this.host.addEventListener("context-request",this.onContextRequest),this.host.addEventListener("context-provider",this.onProviderRequest)}hostConnected(){this.host.dispatchEvent(new Ja(this.context,this.host))}};function ts({context:t}){return(e,o)=>{let i=new WeakMap;if(typeof o=="object")return{get(){return e.get.call(this)},set(r){return i.get(this).setValue(r),e.set.call(this,r)},init(r){return i.set(this,new si(this,{context:t,initialValue:r})),r}};{e.constructor.addInitializer((n=>{i.set(n,new si(n,{context:t}))}));let r=Object.getOwnPropertyDescriptor(e,o),s;if(r===void 0){let n=new WeakMap;s={get(){return n.get(this)},set(c){i.get(this).setValue(c),n.set(this,c)},configurable:!0,enumerable:!0}}else{let n=r.set;s={...r,set(c){i.get(this).setValue(c),n?.call(this,c)}}}return void Object.defineProperty(e,o,s)}}}function es({context:t,subscribe:e}){return(o,i)=>{typeof i=="object"?i.addInitializer((function(){new ai(this,{context:t,callback:r=>{o.set.call(this,r)},subscribe:e})})):o.constructor.addInitializer((r=>{new ai(r,{context:t,callback:s=>{r[i]=s},subscribe:e})}))}}var os="wa-tree-item",J=class extends E{constructor(){super(...arguments),this.localize=new I(this),this.indeterminate=!1,this.isLeaf=!1,this.loading=!1,this.selectable=!1,this.expanded=!1,this.selected=!1,this.disabled=!1,this.lazy=!1,this._treeItemContext={depth:0,expanded:this.expanded},this._parentTreeContext=null,this.animationGeneration=0,this.tabIndex=-1,this.role="treeitem"}static isTreeItem(t){let e=t;return e&&(e.role==="treeitem"||e.getAttribute?.("role")==="treeitem")}connectedCallback(){super.connectedCallback(),this.setAttribute("role","treeitem"),this.setAttribute("tabIndex",this.tabIndex.toString()),this.isNestedItem()&&(this.setAttribute("slot","children"),this._parentTreeContext?.expanded||(this.expanded=!1)),this._parentTreeContext&&(this._treeItemContext={depth:this._parentTreeContext.depth+1,expanded:this.expanded}),this.updateIndentation()}firstUpdated(){this.childrenContainer.hidden=!this.expanded,this.childrenContainer.style.height=this.expanded?"auto":"0",this.isLeaf=!this.lazy&&this.getChildrenItems().length===0,this.handleExpandedChange()}async animateCollapse(t){this.dispatchEvent(new eh);let e=Ke(getComputedStyle(this.childrenContainer).getPropertyValue("--hide-duration"));await ke(this.childrenContainer,[{height:`${this.childrenContainer.scrollHeight}px`,opacity:"1",overflow:"hidden"},{height:"0",opacity:"0",overflow:"hidden"}],{duration:e,easing:"cubic-bezier(0.4, 0.0, 0.2, 1)"}),this.animationGeneration===t&&(this.childrenContainer.hidden=!0,this.dispatchEvent(new oh))}isNestedItem(){if(this._parentTreeContext!==null)return!0;let t=this.parentElement;return!!t&&J.isTreeItem(t)}updateIndentation(){let t=Math.max(this._treeItemContext?.depth||0,this.getDepth());this.setStyleProperty("--indent",`calc(${t} * var(--indent-size, 2em))`)}getDepth(){let t=0,e=this.parentElement;for(;e;)J.isTreeItem(e)&&t++,e=e.parentElement;return t}handleChildrenSlotChange(){this.loading=!1,this.isLeaf=!this.lazy&&this.getChildrenItems().length===0}willUpdate(t){t.has("selected")&&!t.has("indeterminate")&&(this.indeterminate=!1),super.willUpdate(t)}async animateExpand(t){this.dispatchEvent(new th),this.childrenContainer.hidden=!1;let e=Ke(getComputedStyle(this.childrenContainer).getPropertyValue("--show-duration"));await ke(this.childrenContainer,[{height:"0",opacity:"0",overflow:"hidden"},{height:`${this.childrenContainer.scrollHeight}px`,opacity:"1",overflow:"hidden"}],{duration:e,easing:"cubic-bezier(0.4, 0.0, 0.2, 1)"}),this.animationGeneration===t&&(this.childrenContainer.style.height="auto",this.dispatchEvent(new ih))}handleLoadingChange(){this.setAttribute("aria-busy",this.loading?"true":"false"),this.loading||this.animateExpand(this.animationGeneration)}handleDisabledChange(){this.customStates.set("disabled",this.disabled),this.setAttribute("aria-disabled",this.disabled?"true":"false")}handleExpandedState(){this.customStates.set("expanded",this.expanded)}handleIndeterminateStateChange(){this.customStates.set("indeterminate",this.indeterminate)}handleSelectedChange(){this.customStates.set("selected",this.selected),this.setAttribute("aria-selected",this.selected?"true":"false")}handleExpandedChange(){this.isLeaf?this.removeAttribute("aria-expanded"):this.setAttribute("aria-expanded",this.expanded?"true":"false")}handleExpandAnimation(){this.animationGeneration++;let t=this.animationGeneration;this.expanded?this.lazy?(this.loading=!0,this.dispatchEvent(new Jc)):this.animateExpand(t):this.animateCollapse(t)}handleLazyChange(){this.dispatchEvent(new Qc)}getChildrenItems({includeDisabled:t=!0}={}){return this.childrenSlot?[...this.childrenSlot.assignedElements({flatten:!0})].filter(e=>J.isTreeItem(e)&&(t||!e.disabled)):[]}render(){let t=this.localize.dir()==="rtl",e=!this.loading&&(!this.isLeaf||this.lazy);return p`
      <div
        part="base tree-item"
        class="${_({"tree-item":!0,"tree-item-expanded":this.expanded,"tree-item-selected":this.selected,"tree-item-leaf":this.isLeaf,"tree-item-loading":this.loading,"tree-item-has-expand-button":e})}"
      >
        <div class="item" part="item">
          <div class="indentation" part="indentation"></div>

          <div
            part="expand-button"
            class=${_({"expand-button":!0,"expand-button-visible":e})}
            aria-hidden="true"
          >
            <slot class="expand-icon-slot" name="expand-icon">
              ${qe(this.loading,()=>p` <wa-spinner part="spinner" exportparts="base:spinner__base"></wa-spinner> `,()=>p`
                  <wa-icon name=${t?"chevron-left":"chevron-right"} library="system" variant="solid"></wa-icon>
                `)}
            </slot>
            <slot class="expand-icon-slot" name="collapse-icon">
              <wa-icon name=${t?"chevron-left":"chevron-right"} library="system" variant="solid"></wa-icon>
            </slot>
          </div>

          ${qe(this.selectable,()=>p`
              <wa-checkbox
                part="checkbox"
                exportparts="
                    base:checkbox__base,
                    control:checkbox__control,
                    checked-icon:checkbox__checked-icon,
                    indeterminate-icon:checkbox__indeterminate-icon,
                    label:checkbox__label
                  "
                class="checkbox"
                ?disabled="${this.disabled}"
                ?checked="${Mt(this.selected)}"
                ?indeterminate="${this.indeterminate}"
                tabindex="-1"
              ></wa-checkbox>
            `)}

          <slot class="label" part="label"></slot>
        </div>

        <div class="children" part="children" role="group" ?hidden=${!this.expanded&&!this.isConnected}>
          <slot name="children" @slotchange="${this.handleChildrenSlotChange}"></slot>
        </div>
      </div>
    `}};J.css=rh;a([A()],J.prototype,"indeterminate",2);a([A()],J.prototype,"isLeaf",2);a([A()],J.prototype,"loading",2);a([A()],J.prototype,"selectable",2);a([l({type:Boolean,reflect:!0})],J.prototype,"expanded",2);a([l({type:Boolean,reflect:!0})],J.prototype,"selected",2);a([l({type:Boolean,reflect:!0})],J.prototype,"disabled",2);a([l({type:Boolean,reflect:!0})],J.prototype,"lazy",2);a([ts({context:os})],J.prototype,"_treeItemContext",2);a([es({context:os,subscribe:!1})],J.prototype,"_parentTreeContext",2);a([S("slot:not([name])")],J.prototype,"defaultSlot",2);a([S("slot[name=children]")],J.prototype,"childrenSlot",2);a([S(".item")],J.prototype,"itemElement",2);a([S(".children")],J.prototype,"childrenContainer",2);a([S(".expand-button slot")],J.prototype,"expandButtonSlot",2);a([l({reflect:!0,type:Number,attribute:"tabindex"})],J.prototype,"tabIndex",2);a([l({reflect:!0})],J.prototype,"role",2);a([y("loading",{waitUntilFirstUpdate:!0})],J.prototype,"handleLoadingChange",1);a([y("disabled")],J.prototype,"handleDisabledChange",1);a([y("expanded")],J.prototype,"handleExpandedState",1);a([y("indeterminate")],J.prototype,"handleIndeterminateStateChange",1);a([y("selected")],J.prototype,"handleSelectedChange",1);a([y("expanded",{waitUntilFirstUpdate:!0})],J.prototype,"handleExpandedChange",1);a([y("expanded",{waitUntilFirstUpdate:!0})],J.prototype,"handleExpandAnimation",1);a([y("lazy",{waitUntilFirstUpdate:!0})],J.prototype,"handleLazyChange",1);J=a([k("wa-tree-item")],J);J.disableWarning?.("change-in-update");var ah=C`
  :host {
    /*
     * These are actually used by tree item, but we define them here so they can more easily be set and all tree items
     * stay consistent.
     */
    --indent-guide-color: var(--wa-color-surface-border);
    --indent-guide-offset: 0;
    --indent-guide-style: solid;
    --indent-guide-width: 0;
    --indent-size: 2em;

    display: block;
  }
`;function sh(t,e=!1){function o(s){let n=s.getChildrenItems({includeDisabled:!1});if(n.length){let c=n.every(d=>d.selected),h=n.every(d=>!d.selected&&!d.indeterminate);s.selected=c,s.indeterminate=!c&&!h}}function i(s){let n=s.parentElement;J.isTreeItem(n)&&(o(n),i(n))}function r(s){for(let n of s.getChildrenItems())n.selected=e?s.selected||n.selected:!n.disabled&&s.selected,r(n);e&&o(s)}r(t),i(t)}var Te=class extends E{constructor(){super(),this.selection="single",this.clickTarget=null,this.localize=new I(this),this.tabIndex=0,this.role="tree",this.initTreeItem=t=>{t.updateComplete.then(()=>{t.selectable=this.selection==="multiple"||this.selection==="leaf-multiple"&&t.isLeaf,["expand","collapse"].filter(e=>!!this.querySelector(`[slot="${e}-icon"]`)).forEach(e=>{let o=t.querySelector(`[slot="${e}-icon"]`),i=this.getExpandButtonIcon(e);i&&(o===null?t.append(i):o.hasAttribute("data-default")&&o.replaceWith(i))})})},this.handleTreeChanged=t=>{for(let e of t){let o=[...e.addedNodes].filter(J.isTreeItem),i=[...e.removedNodes].filter(J.isTreeItem);o.forEach(this.initTreeItem),this.lastFocusedItem&&i.includes(this.lastFocusedItem)&&(this.lastFocusedItem=null)}},this.handleFocusOut=t=>{let e=t.relatedTarget;(!e||!this.contains(e))&&(this.tabIndex=0)},this.handleFocusIn=t=>{let e=t.target;t.target===this&&this.focusItem(this.lastFocusedItem||this.getAllTreeItems()[0]),J.isTreeItem(e)&&!e.disabled&&(this.lastFocusedItem&&(this.lastFocusedItem.tabIndex=-1),this.lastFocusedItem=e,this.tabIndex=-1,e.tabIndex=0)},"addEventListener"in this&&(this.addEventListener("focusin",this.handleFocusIn),this.addEventListener("focusout",this.handleFocusOut),this.addEventListener("wa-lazy-change",this.handleSlotChange))}async connectedCallback(){super.connectedCallback(),typeof MutationObserver<"u"&&(await this.updateComplete,this.mutationObserver=new MutationObserver(this.handleTreeChanged),this.mutationObserver.observe(this,{childList:!0,subtree:!0})),this.setAttribute("tabindex","0"),this.setAttribute("role","tree")}disconnectedCallback(){super.disconnectedCallback(),this.mutationObserver?.disconnect()}getExpandButtonIcon(t){let o=(t==="expand"?this.expandedIconSlot:this.collapsedIconSlot).assignedElements({flatten:!0})[0];if(o){let i=o.cloneNode(!0);return[i,...i.querySelectorAll("[id]")].forEach(r=>r.removeAttribute("id")),i.setAttribute("data-default",""),i.slot=`${t}-icon`,i}return null}selectItem(t){let e=[...this.selectedItems];if(this.selection==="multiple")t.selected=!t.selected,t.lazy&&(t.expanded=!0),sh(t);else if(this.selection==="leaf-multiple")t.isLeaf?t.selected=!t.selected:t.expanded=!t.expanded;else if(this.selection==="single"||t.isLeaf){let i=this.getAllTreeItems();for(let r of i)r.selected=r===t}else this.selection==="leaf"&&(t.expanded=!t.expanded);let o=this.selectedItems;(e.length!==o.length||o.some(i=>!e.includes(i)))&&Promise.all(o.map(i=>i.updateComplete)).then(()=>{this.dispatchEvent(new Zc({selection:o}))})}getAllTreeItems(){return[...this.querySelectorAll("wa-tree-item")]}focusItem(t){t?.focus()}handleKeyDown(t){if(!["ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Home","End","Enter"," "].includes(t.key)||t.composedPath().some(r=>["input","textarea"].includes(r?.tagName?.toLowerCase())))return;let e=this.getFocusableItems(),o=this.matches(":dir(ltr)"),i=this.localize.dir()==="rtl";if(e.length>0){let r=e.findIndex(h=>h.matches(":focus")),s=e[r];if(!s&&(t.key==="Enter"||t.key===" "))return;t.preventDefault();let n=h=>{let d=e[W(h,0,e.length-1)];this.focusItem(d)},c=h=>{s.expanded=h};t.key==="ArrowDown"?n(r+1):t.key==="ArrowUp"?n(r-1):o&&t.key==="ArrowRight"||i&&t.key==="ArrowLeft"?!s||s.disabled||s.expanded||s.isLeaf&&!s.lazy?n(r+1):c(!0):o&&t.key==="ArrowLeft"||i&&t.key==="ArrowRight"?!s||s.disabled||s.isLeaf||!s.expanded?n(r-1):c(!1):t.key==="Home"?n(0):t.key==="End"?n(e.length-1):(t.key==="Enter"||t.key===" ")&&s&&!s.disabled&&this.selectItem(s)}}handleClick(t){let e=t.target,o=e.closest("wa-tree-item"),i=t.composedPath().some(r=>r?.classList?.contains("expand-button"));!o||o.disabled||e!==this.clickTarget||(i?o.expanded=!o.expanded:this.selectItem(o))}handleMouseDown(t){this.clickTarget=t.target}handleSlotChange(){this.getAllTreeItems().forEach(this.initTreeItem)}async handleSelectionChange(){let t=this.selection==="multiple",e=this.selection==="leaf-multiple",o=this.getAllTreeItems();this.setAttribute("aria-multiselectable",t||e?"true":"false");for(let i of o)i.updateComplete.then(()=>{i.selectable=t||e&&i.isLeaf});t&&(await this.updateComplete,[...this.querySelectorAll(":scope > wa-tree-item")].forEach(i=>{i.updateComplete.then(()=>{sh(i,!0)})}))}get selectedItems(){let t=this.getAllTreeItems(),e=o=>o.selected;return t.filter(e)}getFocusableItems(){let t=this.getAllTreeItems(),e=new Set;return t.filter(o=>{if(o.disabled)return!1;let i=o.parentElement?.closest("[role=treeitem]");return i&&(!i.expanded||i.loading||e.has(i))&&e.add(o),!e.has(o)})}render(){return p`
      <div
        part="base tree"
        class="tree"
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
        <span hidden aria-hidden="true"><slot name="expand-icon"></slot></span>
        <span hidden aria-hidden="true"><slot name="collapse-icon"></slot></span>
      </div>
    `}};Te.css=ah;a([S("slot:not([name])")],Te.prototype,"defaultSlot",2);a([S("slot[name=expand-icon]")],Te.prototype,"expandedIconSlot",2);a([S("slot[name=collapse-icon]")],Te.prototype,"collapsedIconSlot",2);a([l()],Te.prototype,"selection",2);a([l({attribute:"tabindex",reflect:!0,type:Number})],Te.prototype,"tabIndex",2);a([l({reflect:!0})],Te.prototype,"role",2);a([y("selection")],Te.prototype,"handleSelectionChange",1);Te=a([k("wa-tree")],Te);var nh=C`
  :host {
    display: block;
    position: relative;
    aspect-ratio: 16 / 9;
    width: 100%;
    overflow: hidden;
    border-radius: var(--wa-border-radius-m);
  }

  #frame-container {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% / var(--zoom));
    height: calc(100% / var(--zoom));
    transform: scale(var(--zoom));
    transform-origin: 0 0;
  }

  #iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: inherit;
    /* Prevent the iframe from being selected, e.g. by a double click. Doesn't affect selection withing the iframe. */
    user-select: none;
    -webkit-user-select: none;
  }

  #controls {
    display: flex;
    position: absolute;
    bottom: 0.5em;
    align-items: center;
    font-weight: var(--wa-font-weight-semibold);
    padding: 0.25em 0.5em;
    gap: 0.5em;
    border-radius: var(--wa-border-radius-s);
    background: #000b;
    color: white;
    font-size: min(12px, 0.75em);
    user-select: none;
    -webkit-user-select: none;

    &:dir(ltr) {
      right: 0.5em;
    }

    &:dir(rtl) {
      left: 0.5em;
    }

    button {
      display: flex;
      align-items: center;
      padding: 0.25em;
      border: none;
      background: none;
      color: inherit;
      cursor: pointer;

      &:focus {
        outline: none;
      }

      &:focus-visible {
        outline: var(--wa-focus-ring);
        outline-offset: var(--wa-focus-ring-offset);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }

    span {
      min-width: 4.5ch; /* extra space so numbers don't shift */
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
  }
`;var Cm=class{constructor(t,e){this.handleTransitionEnd=()=>{this.onThemeChange()},(this.host=t).addController(this),this.onThemeChange=e,typeof document<"u"&&(this.hiddenElement=document.createElement("div"),this.hiddenElement.setAttribute("aria-hidden","true"),Object.assign(this.hiddenElement.style,{position:"absolute",width:"0",height:"0",overflow:"hidden",pointerEvents:"none",opacity:"0",color:"var(--wa-color-surface-default, transparent)",transition:"color 0.001ms"}))}hostConnected(){this.hiddenElement&&(this.host.appendChild(this.hiddenElement),this.hiddenElement.addEventListener("transitionend",this.handleTransitionEnd))}hostDisconnected(){this.hiddenElement&&(this.hiddenElement.removeEventListener("transitionend",this.handleTransitionEnd),this.hiddenElement.remove())}},Ut=class extends E{constructor(){super(),this.localize=new I(this),this.themeObserver=new MutationObserver(()=>this.syncTheme()),this.availableZoomLevels=[],this.allowfullscreen=!1,this.loading="eager",this.zoom=1,this.zoomLevels="25% 50% 75% 100% 125% 150% 175% 200%",this.withoutControls=!1,this.withoutInteraction=!1,this.withThemeSync=!1,new Cm(this,()=>this.syncTheme())}get contentWindow(){return this.iframe?.contentWindow||null}get contentDocument(){return this.iframe?.contentDocument||null}parseZoomLevels(t){let e=bo(t),o=[];for(let i of e){let r;if(i.endsWith("%")){let s=parseFloat(i.slice(0,-1));if(!isNaN(s))r=Math.max(0,s/100);else continue}else if(r=parseFloat(i),!isNaN(r))r=Math.max(0,r);else continue;o.push(r)}return[...new Set(o)].sort((i,r)=>i-r)}getCurrentZoomIndex(){if(this.availableZoomLevels.length===0)return-1;let t=0,e=Math.abs(this.availableZoomLevels[0]-this.zoom);for(let o=1;o<this.availableZoomLevels.length;o++){let i=Math.abs(this.availableZoomLevels[o]-this.zoom);i<e&&(e=i,t=o)}return t}isZoomInDisabled(){return this.availableZoomLevels.length===0?!1:this.getCurrentZoomIndex()>=this.availableZoomLevels.length-1}isZoomOutDisabled(){return this.availableZoomLevels.length===0?!1:this.getCurrentZoomIndex()<=0}willUpdate(t){t.has("zoom")&&this.setStyleProperty("--zoom",`${this.zoom}`),super.willUpdate(t)}updated(t){if(t.has("zoomLevels")&&(this.availableZoomLevels=this.parseZoomLevels(this.zoomLevels),this.availableZoomLevels.length>0)){let e=this.getCurrentZoomIndex();Math.abs(this.availableZoomLevels[e]-this.zoom)>.001&&(this.zoom=this.availableZoomLevels[e])}t.has("withThemeSync")&&(this.withThemeSync?(this.themeObserver?.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),this.syncTheme()):this.themeObserver?.disconnect()),super.updated(t)}zoomIn(){if(this.availableZoomLevels.length===0){this.zoom=Math.min(this.zoom+.05,2);return}let t=this.getCurrentZoomIndex();t<this.availableZoomLevels.length-1&&(this.zoom=this.availableZoomLevels[t+1])}zoomOut(){if(this.availableZoomLevels.length===0){this.zoom=Math.max(this.zoom-.05,0);return}let t=this.getCurrentZoomIndex();t>0&&(this.zoom=this.availableZoomLevels[t-1])}disconnectedCallback(){super.disconnectedCallback(),this.themeObserver?.disconnect()}syncTheme(){if(this.withThemeSync)try{let t=this.contentDocument?.documentElement;if(!t)return;let e=["wa-theme-","wa-brand-","wa-palette-"],o=new Set,i=new Set,r=this,s=!1;for(;r;){s||(r.classList.contains("wa-dark")?(o.add("wa-dark"),s=!0):r.classList.contains("wa-light")&&(o.add("wa-light"),s=!0));for(let c of r.classList)e.some(h=>c.startsWith(h))&&i.add(c);r=r.parentElement}t.classList.toggle("wa-dark",o.has("wa-dark")),t.classList.toggle("wa-light",o.has("wa-light"));let n=Array.from(t.classList).filter(c=>e.some(h=>c.startsWith(h)));t.classList.remove(...n),t.classList.add(...i)}catch{}}handleLoad(){this.withThemeSync&&this.syncTheme(),this.dispatchEvent(new Event("load",{bubbles:!1,cancelable:!1,composed:!0}))}handleError(){this.dispatchEvent(new Event("error",{bubbles:!1,cancelable:!1,composed:!0}))}render(){return p`
      <div id="frame-container">
        <iframe
          id="iframe"
          part="iframe"
          ?inert=${this.withoutInteraction}
          ?allowfullscreen=${this.allowfullscreen}
          loading=${this.loading}
          referrerpolicy=${this.referrerpolicy}
          sandbox=${M(this.sandbox??void 0)}
          src=${M(this.src??void 0)}
          srcdoc=${M(this.srcdoc??void 0)}
          @load=${this.handleLoad}
          @error=${this.handleError}
        ></iframe>
      </div>

      ${this.withoutControls?"":p`
            <div id="controls" part="controls">
              <button
                part="zoom-out-button"
                aria-label=${this.localize.term("zoomOut")}
                @click=${this.zoomOut}
                ?disabled=${this.isZoomOutDisabled()}
              >
                <slot name="zoom-out-icon">
                  <wa-icon name="minus" label="Zoom out"></wa-icon>
                </slot>
              </button>
              <span>${this.localize.number(this.zoom,{style:"percent",maximumFractionDigits:1})}</span>
              <button
                part="zoom-in-button"
                aria-label=${this.localize.term("zoomIn")}
                @click=${this.zoomIn}
                ?disabled=${this.isZoomInDisabled()}
              >
                <slot name="zoom-in-icon">
                  <wa-icon name="plus" label="Zoom in"></wa-icon>
                </slot>
              </button>
            </div>
          `}
    `}};Ut.css=nh;a([A()],Ut.prototype,"availableZoomLevels",2);a([S("#iframe")],Ut.prototype,"iframe",2);a([l()],Ut.prototype,"src",2);a([l()],Ut.prototype,"srcdoc",2);a([l({type:Boolean})],Ut.prototype,"allowfullscreen",2);a([l()],Ut.prototype,"loading",2);a([l()],Ut.prototype,"referrerpolicy",2);a([l()],Ut.prototype,"sandbox",2);a([l({type:Number,reflect:!0})],Ut.prototype,"zoom",2);a([l({attribute:"zoom-levels"})],Ut.prototype,"zoomLevels",2);a([l({type:Boolean,attribute:"without-controls",reflect:!0})],Ut.prototype,"withoutControls",2);a([l({type:Boolean,attribute:"without-interaction",reflect:!0})],Ut.prototype,"withoutInteraction",2);a([l({type:Boolean,attribute:"with-theme-sync",reflect:!0})],Ut.prototype,"withThemeSync",2);Ut=a([k("wa-zoomable-frame")],Ut);async function km(t){let e={match:s=>s.startsWith("wa-"),additionalElements:[],root:document,...t},o=Array.isArray(e.additionalElements)?e.additionalElements:[e.additionalElements],r=[...[...e.root.querySelectorAll(":not(:defined)")].map(s=>s.localName).filter((s,n,c)=>c.indexOf(s)===n).filter(s=>e.match(s)),...o];await Promise.all(r.map(s=>customElements.whenDefined(s))),await new Promise(requestAnimationFrame)}function Sm(t){let e=new FormData(t),o={};return e.forEach((i,r)=>{if(Reflect.has(o,r)){let s=o[r];Array.isArray(s)?s.push(i):o[r]=[o[r],i]}else o[r]=i}),o}var lh=new MutationObserver(t=>{for(let{addedNodes:e}of t)for(let o of e)o.nodeType===Node.ELEMENT_NODE&&Br(o)});function zm(){Br(document),lh.observe(document.documentElement,{subtree:!0,childList:!0})}function Em(){lh.disconnect()}async function Br(t){let e=t instanceof Element?t.tagName.toLowerCase():"",o=e?.startsWith("wa-"),i=[...t.querySelectorAll(":not(:defined)")].map(h=>h.tagName.toLowerCase()).filter(h=>h.startsWith("wa-"));o&&!customElements.get(e)&&i.push(e);let r=t.querySelectorAll("[data-wa-preload]"),s=t instanceof Element&&t.hasAttribute("data-wa-preload")?[t,...r]:r;for(let h of s)i.push(...h.getAttribute("data-wa-preload").split(/\s+/).filter(d=>d.startsWith("wa-")));let n=[...new Set(i)],c=await Promise.allSettled(n.map(h=>Lm(h)));for(let h of c)h.status==="rejected"&&console.warn(h.reason);await new Promise(requestAnimationFrame),t.dispatchEvent(new CustomEvent("wa-discovery-complete",{bubbles:!1,cancelable:!1,composed:!0}))}function Lm(t){if(customElements.get(t))return Promise.resolve();let e=t.replace(/^wa-/i,""),o=oa(`components/${e}/${e}.js`);return new Promise((i,r)=>{import(o).then(()=>i()).catch(()=>r(new Error(`Unable to autoload <${t}> from ${o}`)))})}var ch=2e3;function $m(t=2e3){ch=t,document.addEventListener("turbo:before-render",Am)}async function Am(t){let e=t.detail.newBody;t.preventDefault();try{await Promise.race([Br(e),new Promise(o=>setTimeout(o,ch))])}finally{t.detail.resume()}}function hh(t,e){return`${t}/${e}`}function _m(t,e){return t==="brands"||e==="brands"?"brands":"solid"}function Tm(t){return`data:image/svg+xml,${encodeURIComponent(t)}`}function dh(t){let e=new Map;return(o,i,r)=>{let s=hh(_m(i,r),o),n=e.get(s);if(n)return n;let c=t[s]??t[hh("solid",o)];if(!c)return;let h=Tm(c);return e.set(s,h),h}}var Mm={"solid/address-book":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M96 0C60.7 0 32 28.7 32 64l0 384c0 35.3 28.7 64 64 64l288 0c35.3 0 64-28.7 64-64l0-384c0-35.3-28.7-64-64-64L96 0zM208 288l64 0c44.2 0 80 35.8 80 80 0 8.8-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16 0-44.2 35.8-80 80-80zm-24-96a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zM512 80c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64zm0 128c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64zM496 320c-8.8 0-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64c0-8.8-7.2-16-16-16z"/></svg>',"solid/align-center":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M352 64c0-17.7-14.3-32-32-32L128 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l192 0c17.7 0 32-14.3 32-32zm96 128c0-17.7-14.3-32-32-32L32 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32zM0 448c0 17.7 14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 416c-17.7 0-32 14.3-32 32zM352 320c0-17.7-14.3-32-32-32l-192 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l192 0c17.7 0 32-14.3 32-32z"/></svg>',"solid/align-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M288 64c0 17.7-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l224 0c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32L32 352c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 224c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>',"solid/align-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M448 64c0 17.7-14.3 32-32 32L192 96c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 224c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>',"solid/angle-down":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M169.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 306.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>',"solid/angle-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg>',"solid/angle-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path fill="currentColor" d="M247.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L179.2 256 41.9 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/></svg>',"solid/angle-up":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M169.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L192 205.3 54.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z"/></svg>',"solid/arrow-down":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M169.4 502.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 402.7 224 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 370.7-105.4-105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>',"solid/arrow-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 105.4-105.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg>',"solid/arrow-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-105.4 105.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/></svg>',"solid/arrow-up":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M214.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 109.3 160 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-370.7 105.4 105.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/></svg>',"solid/arrow-up-right-from-square":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0-201.4 201.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 96C35.8 96 0 131.8 0 176L0 432c0 44.2 35.8 80 80 80l256 0c44.2 0 80-35.8 80-80l0-80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 80c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l80 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 96z"/></svg>',"solid/arrows-rotate":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M65.9 228.5c13.3-93 93.4-164.5 190.1-164.5 53 0 101 21.5 135.8 56.2 .2 .2 .4 .4 .6 .6l7.6 7.2-47.9 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-128c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 53.4-11.3-10.7C390.5 28.6 326.5 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1zm443.5 64c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-53 0-101-21.5-135.8-56.2-.2-.2-.4-.4-.6-.6l-7.6-7.2 47.9 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 320c-8.5 0-16.7 3.4-22.7 9.5S-.1 343.7 0 352.3l1 127c.1 17.7 14.6 31.9 32.3 31.7S65.2 496.4 65 478.7l-.4-51.5 10.7 10.1c46.3 46.1 110.2 74.7 180.7 74.7 129 0 235.7-95.4 253.4-219.5z"/></svg>',"solid/ban":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M367.2 412.5L99.5 144.8c-22.4 31.4-35.5 69.8-35.5 111.2 0 106 86 192 192 192 41.5 0 79.9-13.1 111.2-35.5zm45.3-45.3c22.4-31.4 35.5-69.8 35.5-111.2 0-106-86-192-192-192-41.5 0-79.9 13.1-111.2 35.5L412.5 367.2zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>',"solid/bars":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>',"solid/bell":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M224 0c-17.7 0-32 14.3-32 32l0 3.2C119 50 64 114.6 64 192l0 21.7c0 48.1-16.4 94.8-46.4 132.4L7.8 358.3C2.7 364.6 0 372.4 0 380.5 0 400.1 15.9 416 35.5 416l376.9 0c19.6 0 35.5-15.9 35.5-35.5 0-8.1-2.7-15.9-7.8-22.2l-9.8-12.2C400.4 308.5 384 261.8 384 213.7l0-21.7c0-77.4-55-142-128-156.8l0-3.2c0-17.7-14.3-32-32-32zM162 464c7.1 27.6 32.2 48 62 48s54.9-20.4 62-48l-124 0z"/></svg>',"solid/bolt":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M338.8-9.9c11.9 8.6 16.3 24.2 10.9 37.8L271.3 224 416 224c13.5 0 25.5 8.4 30.1 21.1s.7 26.9-9.6 35.5l-288 240c-11.3 9.4-27.4 9.9-39.3 1.3s-16.3-24.2-10.9-37.8L176.7 288 32 288c-13.5 0-25.5-8.4-30.1-21.1s-.7-26.9 9.6-35.5l288-240c11.3-9.4 27.4-9.9 39.3-1.3z"/></svg>',"solid/book":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M384 512L96 512c-53 0-96-43-96-96L0 96C0 43 43 0 96 0L400 0c26.5 0 48 21.5 48 48l0 288c0 20.9-13.4 38.7-32 45.3l0 66.7c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0zM96 384c-17.7 0-32 14.3-32 32s14.3 32 32 32l256 0 0-64-256 0zm32-232c0 13.3 10.7 24 24 24l176 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-176 0c-13.3 0-24 10.7-24 24zm24 72c-13.3 0-24 10.7-24 24s10.7 24 24 24l176 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-176 0z"/></svg>',"solid/bookmark":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64L0 480c0 11.5 6.2 22.2 16.2 27.8s22.3 5.5 32.2-.4L192 421.3 335.5 507.4c9.9 5.9 22.2 6.1 32.2 .4S384 491.5 384 480l0-416c0-35.3-28.7-64-64-64L64 0z"/></svg>',"solid/briefcase":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M200 48l112 0c4.4 0 8 3.6 8 8l0 40-128 0 0-40c0-4.4 3.6-8 8-8zm-56 8l0 40-80 0C28.7 96 0 124.7 0 160l0 96 512 0 0-96c0-35.3-28.7-64-64-64l-80 0 0-40c0-30.9-25.1-56-56-56L200 0c-30.9 0-56 25.1-56 56zM512 304l-192 0 0 16c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-16-192 0 0 112c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-112z"/></svg>',"solid/bug":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M192 96c0-53 43-96 96-96s96 43 96 96l0 3.6c0 15.7-12.7 28.4-28.4 28.4l-135.1 0c-15.7 0-28.4-12.7-28.4-28.4l0-3.6zm345.6 12.8c10.6 14.1 7.7 34.2-6.4 44.8l-97.8 73.3c5.3 8.9 9.3 18.7 11.8 29.1l98.8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-96 0 0 32c0 2.6-.1 5.3-.2 7.9l83.4 62.5c14.1 10.6 17 30.7 6.4 44.8s-30.7 17-44.8 6.4l-63.1-47.3c-23.2 44.2-66.5 76.2-117.7 83.9L312 280c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 230.2c-51.2-7.7-94.5-39.7-117.7-83.9L83.2 473.6c-14.1 10.6-34.2 7.7-44.8-6.4s-7.7-34.2 6.4-44.8l83.4-62.5c-.1-2.6-.2-5.2-.2-7.9l0-32-96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l98.8 0c2.5-10.4 6.5-20.2 11.8-29.1L44.8 153.6c-14.1-10.6-17-30.7-6.4-44.8s30.7-17 44.8-6.4L192 184c12.3-5.1 25.8-8 40-8l112 0c14.2 0 27.7 2.8 40 8l108.8-81.6c14.1-10.6 34.2-7.7 44.8 6.4z"/></svg>',"solid/building":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-384c0-35.3-28.7-64-64-64L64 0zM176 352l32 0c17.7 0 32 14.3 32 32l0 80-96 0 0-80c0-17.7 14.3-32 32-32zM96 112c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zM240 96l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16zM96 240c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32zm144-16l32 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16z"/></svg>',"solid/calendar-days":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l32 0 0-32c0-17.7 14.3-32 32-32zM64 240l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm128 0l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM64 368l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zm112 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"/></svg>',"solid/camera":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M149.1 64.8L138.7 96 64 96C28.7 96 0 124.7 0 160L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64l-74.7 0-10.4-31.2C356.4 45.2 338.1 32 317.4 32L194.6 32c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/></svg>',"solid/cart-shopping":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M24-16C10.7-16 0-5.3 0 8S10.7 32 24 32l45.3 0c3.9 0 7.2 2.8 7.9 6.6l52.1 286.3c6.2 34.2 36 59.1 70.8 59.1L456 384c13.3 0 24-10.7 24-24s-10.7-24-24-24l-255.9 0c-11.6 0-21.5-8.3-23.6-19.7l-5.1-28.3 303.6 0c30.8 0 57.2-21.9 62.9-52.2L568.9 69.9C572.6 50.2 557.5 32 537.4 32l-412.7 0-.4-2c-4.8-26.6-28-46-55.1-46L24-16zM208 512a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm224 0a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/></svg>',"solid/chart-line":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64L0 400c0 44.2 35.8 80 80 80l400 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 416c-8.8 0-16-7.2-16-16L64 64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7 262.6 153.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l73.4-73.4 57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z"/></svg>',"solid/chart-pie":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M512.4 240l-176 0c-17.7 0-32-14.3-32-32l0-176c0-17.7 14.4-32.2 31.9-29.9 107 14.2 191.8 99 206 206 2.3 17.5-12.2 31.9-29.9 31.9zM222.6 37.2c18.1-3.8 33.8 11 33.8 29.5l0 197.3c0 5.6 2 11 5.5 15.3L394 438.7c11.7 14.1 9.2 35.4-6.9 44.1-34.1 18.6-73.2 29.2-114.7 29.2-132.5 0-240-107.5-240-240 0-115.5 81.5-211.9 190.2-234.8zM477.8 288l64 0c18.5 0 33.3 15.7 29.5 33.8-10.2 48.4-35 91.4-69.6 124.2-12.3 11.7-31.6 9.2-42.4-3.9L374.9 340.4c-17.3-20.9-2.4-52.4 24.6-52.4l78.2 0z"/></svg>',"solid/check":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"/></svg>',"solid/chevron-down":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M201.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 338.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>',"solid/chevron-left":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>',"solid/chevron-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path fill="currentColor" d="M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>',"solid/chevron-up":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M201.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 173.3 54.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"/></svg>',"solid/circle":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>',"solid/circle-check":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 1 0-512 256 256 0 1 1 0 512zM374 145.7c-10.7-7.8-25.7-5.4-33.5 5.3L221.1 315.2 169 263.1c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l72 72c5 5 11.8 7.5 18.8 7s13.4-4.1 17.5-9.8L379.3 179.2c7.8-10.7 5.4-25.7-5.3-33.5z"/></svg>',"solid/circle-exclamation":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 1 0-512 256 256 0 1 1 0 512zm0-192a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.6 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"/></svg>',"solid/circle-info":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM224 160a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm-8 64l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z"/></svg>',"solid/circle-minus":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM168 232l176 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-176 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z"/></svg>',"solid/circle-plus":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM232 344l0-64-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0 0-64c0-13.3 10.7-24 24-24s24 10.7 24 24l0 64 64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0 0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24z"/></svg>',"solid/circle-question":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zm0-336c-17.7 0-32 14.3-32 32 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-44.2 35.8-80 80-80s80 35.8 80 80c0 47.2-36 67.2-56 74.5l0 3.8c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-8.1c0-20.5 14.8-35.2 30.1-40.2 6.4-2.1 13.2-5.5 18.2-10.3 4.3-4.2 7.7-10 7.7-19.6 0-17.7-14.3-32-32-32zM224 368a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',"solid/circle-xmark":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM167 167c9.4-9.4 24.6-9.4 33.9 0l55 55 55-55c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-55 55 55 55c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-55-55-55 55c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l55-55-55-55c-9.4-9.4-9.4-24.6 0-33.9z"/></svg>',"solid/clock":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 0a256 256 0 1 1 0 512 256 256 0 1 1 0-512zM232 120l0 136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2 280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>',"solid/cloud":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M0 336c0 79.5 64.5 144 144 144l304 0c70.7 0 128-57.3 128-128 0-51.6-30.5-96.1-74.5-116.3 6.7-13.1 10.5-28 10.5-43.7 0-53-43-96-96-96-17.7 0-34.2 4.8-48.4 13.1-24.1-45.8-72.2-77.1-127.6-77.1-79.5 0-144 64.5-144 144 0 8 .7 15.9 1.9 23.5-56.9 19.2-97.9 73.1-97.9 136.5z"/></svg>',"solid/code":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M360.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm64.6 136.1c-12.5 12.5-12.5 32.8 0 45.3l73.4 73.4-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0zm-274.7 0c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 150.6 182.6c12.5-12.5 12.5-32.8 0-45.3z"/></svg>',"solid/comment":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M512 240c0 132.5-114.6 240-256 240-37.1 0-72.3-7.4-104.1-20.7L33.5 510.1c-9.4 4-20.2 1.7-27.1-5.8S-2 485.8 2.8 476.8l48.8-92.2C19.2 344.3 0 294.3 0 240 0 107.5 114.6 0 256 0S512 107.5 512 240z"/></svg>',"solid/comments":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M384 144c0 97.2-86 176-192 176-26.7 0-52.1-5-75.2-14L35.2 349.2c-9.3 4.9-20.7 3.2-28.2-4.2s-9.2-18.9-4.2-28.2l35.6-67.2C14.3 220.2 0 183.6 0 144 0 46.8 86-32 192-32S384 46.8 384 144zm0 368c-94.1 0-172.4-62.1-188.8-144 120-1.5 224.3-86.9 235.8-202.7 83.3 19.2 145 88.3 145 170.7 0 39.6-14.3 76.2-38.4 105.6l35.6 67.2c4.9 9.3 3.2 20.7-4.2 28.2s-18.9 9.2-28.2 4.2L459.2 498c-23.1 9-48.5 14-75.2 14z"/></svg>',"solid/compress":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M160 64c0-17.7-14.3-32-32-32S96 46.3 96 64l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 320c-17.7 0-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0z"/></svg>',"solid/copy":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-200.6c0-17.4-7.1-34.1-19.7-46.2L370.6 17.8C358.7 6.4 342.8 0 326.3 0L192 0zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-64 0 0 16-192 0 0-256 16 0 0-64-16 0z"/></svg>',"solid/credit-card":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 128l0 32 512 0 0-32c0-35.3-28.7-64-64-64L64 64C28.7 64 0 92.7 0 128zm0 80L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-176-512 0zM64 360c0-13.3 10.7-24 24-24l48 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-48 0c-13.3 0-24-10.7-24-24zm144 0c0-13.3 10.7-24 24-24l64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0c-13.3 0-24-10.7-24-24z"/></svg>',"solid/database":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M448 205.8c-14.8 9.8-31.8 17.7-49.5 24-47 16.8-108.7 26.2-174.5 26.2S96.4 246.5 49.5 229.8c-17.6-6.3-34.7-14.2-49.5-24L0 288c0 44.2 100.3 80 224 80s224-35.8 224-80l0-82.2zm0-77.8l0-48C448 35.8 347.7 0 224 0S0 35.8 0 80l0 48c0 44.2 100.3 80 224 80s224-35.8 224-80zM398.5 389.8C351.6 406.5 289.9 416 224 416S96.4 406.5 49.5 389.8c-17.6-6.3-34.7-14.2-49.5-24L0 432c0 44.2 100.3 80 224 80s224-35.8 224-80l0-66.2c-14.8 9.8-31.8 17.7-49.5 24z"/></svg>',"solid/download":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M256 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 210.7-41.4-41.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 242.7 256 32zM64 320c-35.3 0-64 28.7-64 64l0 32c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-32c0-35.3-28.7-64-64-64l-46.9 0-56.6 56.6c-31.2 31.2-81.9 31.2-113.1 0L110.9 320 64 320zm304 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/></svg>',"solid/ellipsis":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 256a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm168 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm224-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z"/></svg>',"solid/ellipsis-vertical":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512"><path fill="currentColor" d="M64 144a56 56 0 1 1 0-112 56 56 0 1 1 0 112zm0 224c30.9 0 56 25.1 56 56s-25.1 56-56 56-56-25.1-56-56 25.1-56 56-56zm56-112c0 30.9-25.1 56-56 56s-56-25.1-56-56 25.1-56 56-56 56 25.1 56 56z"/></svg>',"solid/envelope":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M48 64c-26.5 0-48 21.5-48 48 0 15.1 7.1 29.3 19.2 38.4l208 156c17.1 12.8 40.5 12.8 57.6 0l208-156c12.1-9.1 19.2-23.3 19.2-38.4 0-26.5-21.5-48-48-48L48 64zM0 196L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-188-198.4 148.8c-34.1 25.6-81.1 25.6-115.2 0L0 196z"/></svg>',"solid/expand":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M32 32C14.3 32 0 46.3 0 64l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 32zM64 352c0-17.7-14.3-32-32-32S0 334.3 0 352l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96z"/></svg>',"solid/eye":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M288 32c-80.8 0-145.5 36.8-192.6 80.6-46.8 43.5-78.1 95.4-93 131.1-3.3 7.9-3.3 16.7 0 24.6 14.9 35.7 46.2 87.7 93 131.1 47.1 43.7 111.8 80.6 192.6 80.6s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1 3.3-7.9 3.3-16.7 0-24.6-14.9-35.7-46.2-87.7-93-131.1-47.1-43.7-111.8-80.6-192.6-80.6zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64-11.5 0-22.3-3-31.7-8.4-1 10.9-.1 22.1 2.9 33.2 13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-12.2-45.7-55.5-74.8-101.1-70.8 5.3 9.3 8.4 20.1 8.4 31.7z"/></svg>',"solid/eye-slash":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M41-24.9c-9.4-9.4-24.6-9.4-33.9 0S-2.3-.3 7 9.1l528 528c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-96.4-96.4c2.7-2.4 5.4-4.8 8-7.2 46.8-43.5 78.1-95.4 93-131.1 3.3-7.9 3.3-16.7 0-24.6-14.9-35.7-46.2-87.7-93-131.1-47.1-43.7-111.8-80.6-192.6-80.6-56.8 0-105.6 18.2-146 44.2L41-24.9zM204.5 138.7c23.5-16.8 52.4-26.7 83.5-26.7 79.5 0 144 64.5 144 144 0 31.1-9.9 59.9-26.7 83.5l-34.7-34.7c12.7-21.4 17-47.7 10.1-73.7-13.7-51.2-66.4-81.6-117.6-67.9-8.6 2.3-16.7 5.7-24 10l-34.7-34.7zM325.3 395.1c-11.9 3.2-24.4 4.9-37.3 4.9-79.5 0-144-64.5-144-144 0-12.9 1.7-25.4 4.9-37.3L69.4 139.2c-32.6 36.8-55 75.8-66.9 104.5-3.3 7.9-3.3 16.7 0 24.6 14.9 35.7 46.2 87.7 93 131.1 47.1 43.7 111.8 80.6 192.6 80.6 37.3 0 71.2-7.9 101.5-20.6l-64.2-64.2z"/></svg>',"solid/face-smile":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM165.4 321.9c20.4 28 53.4 46.1 90.6 46.1s70.2-18.1 90.6-46.1c7.8-10.7 22.8-13.1 33.5-5.3s13.1 22.8 5.3 33.5C356.3 390 309.2 416 256 416s-100.3-26-129.4-65.9c-7.8-10.7-5.4-25.7 5.3-33.5s25.7-5.4 33.5 5.3zM144 208a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm192-32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',"solid/file":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-277.5c0-17-6.7-33.3-18.7-45.3L258.7 18.7C246.7 6.7 230.5 0 213.5 0L64 0zM325.5 176L232 176c-13.3 0-24-10.7-24-24L208 58.5 325.5 176z"/></svg>',"solid/file-lines":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M0 64C0 28.7 28.7 0 64 0L213.5 0c17 0 33.3 6.7 45.3 18.7L365.3 125.3c12 12 18.7 28.3 18.7 45.3L384 448c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm208-5.5l0 93.5c0 13.3 10.7 24 24 24L325.5 176 208 58.5zM120 256c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0z"/></svg>',"solid/filter":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M32 64C19.1 64 7.4 71.8 2.4 83.8S.2 109.5 9.4 118.6L192 301.3 192 416c0 8.5 3.4 16.6 9.4 22.6l64 64c9.2 9.2 22.9 11.9 34.9 6.9S320 492.9 320 480l0-178.7 182.6-182.6c9.2-9.2 11.9-22.9 6.9-34.9S492.9 64 480 64L32 64z"/></svg>',"solid/fire":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M160.5-26.4c9.3-7.8 23-7.5 31.9 .9 12.3 11.6 23.3 24.4 33.9 37.4 13.5 16.5 29.7 38.3 45.3 64.2 5.2-6.8 10-12.8 14.2-17.9 1.1-1.3 2.2-2.7 3.3-4.1 7.9-9.8 17.7-22.1 30.8-22.1 13.4 0 22.8 11.9 30.8 22.1 1.3 1.7 2.6 3.3 3.9 4.8 10.3 12.4 24 30.3 37.7 52.4 27.2 43.9 55.6 106.4 55.6 176.6 0 123.7-100.3 224-224 224S0 411.7 0 288c0-91.1 41.1-170 80.5-225 19.9-27.7 39.7-49.9 54.6-65.1 8.2-8.4 16.5-16.7 25.5-24.2zM225.7 416c25.3 0 47.7-7 68.8-21 42.1-29.4 53.4-88.2 28.1-134.4-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5-17.3-22.1-49.1-62.4-65.3-83-5.4-6.9-15.2-8-21.5-1.9-18.3 17.8-51.5 56.8-51.5 104.3 0 68.6 50.6 109.2 113.7 109.2z"/></svg>',"solid/folder":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 448l384 0c35.3 0 64-28.7 64-64l0-240c0-35.3-28.7-64-64-64L298.7 80c-6.9 0-13.7-2.2-19.2-6.4L241.1 44.8C230 36.5 216.5 32 202.7 32L64 32C28.7 32 0 60.7 0 96L0 384c0 35.3 28.7 64 64 64z"/></svg>',"solid/folder-open":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M56 225.6L32.4 296.2 32.4 96c0-35.3 28.7-64 64-64l138.7 0c13.8 0 27.3 4.5 38.4 12.8l38.4 28.8c5.5 4.2 12.3 6.4 19.2 6.4l117.3 0c35.3 0 64 28.7 64 64l0 16-365.4 0c-41.3 0-78 26.4-91.1 65.6zM477.8 448L99 448c-32.8 0-55.9-32.1-45.5-63.2l48-144C108 221.2 126.4 208 147 208l378.8 0c32.8 0 55.9 32.1 45.5 63.2l-48 144c-6.5 19.6-24.9 32.8-45.5 32.8z"/></svg>',"solid/gear":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/></svg>',"solid/gift":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M321.5 68.8C329.1 55.9 342.9 48 357.8 48l2.2 0c22.1 0 40 17.9 40 40s-17.9 40-40 40l-73.3 0 34.8-59.2zm-131 0l34.8 59.2-73.3 0c-22.1 0-40-17.9-40-40s17.9-40 40-40l2.2 0c14.9 0 28.8 7.9 36.3 20.8zm89.6-24.3l-24.1 41-24.1-41C215.7 16.9 186.1 0 154.2 0L152 0c-48.6 0-88 39.4-88 88 0 14.4 3.5 28 9.6 40L32 128c-17.7 0-32 14.3-32 32l0 32c0 17.7 14.3 32 32 32l448 0c17.7 0 32-14.3 32-32l0-32c0-17.7-14.3-32-32-32l-41.6 0c6.1-12 9.6-25.6 9.6-40 0-48.6-39.4-88-88-88l-2.2 0c-31.9 0-61.5 16.9-77.7 44.4zM480 272l-200 0 0 208 136 0c35.3 0 64-28.7 64-64l0-144zm-248 0l-200 0 0 144c0 35.3 28.7 64 64 64l136 0 0-208z"/></svg>',"solid/globe":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M351.9 280l-190.9 0c2.9 64.5 17.2 123.9 37.5 167.4 11.4 24.5 23.7 41.8 35.1 52.4 11.2 10.5 18.9 12.2 22.9 12.2s11.7-1.7 22.9-12.2c11.4-10.6 23.7-28 35.1-52.4 20.3-43.5 34.6-102.9 37.5-167.4zM160.9 232l190.9 0C349 167.5 334.7 108.1 314.4 64.6 303 40.2 290.7 22.8 279.3 12.2 268.1 1.7 260.4 0 256.4 0s-11.7 1.7-22.9 12.2c-11.4 10.6-23.7 28-35.1 52.4-20.3 43.5-34.6 102.9-37.5 167.4zm-48 0C116.4 146.4 138.5 66.9 170.8 14.7 78.7 47.3 10.9 131.2 1.5 232l111.4 0zM1.5 280c9.4 100.8 77.2 184.7 169.3 217.3-32.3-52.2-54.4-131.7-57.9-217.3L1.5 280zm398.4 0c-3.5 85.6-25.6 165.1-57.9 217.3 92.1-32.7 159.9-116.5 169.3-217.3l-111.4 0zm111.4-48C501.9 131.2 434.1 47.3 342 14.7 374.3 66.9 396.4 146.4 399.9 232l111.4 0z"/></svg>',"solid/graduation-cap":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M48 195.8l209.2 86.1c9.8 4 20.2 6.1 30.8 6.1s21-2.1 30.8-6.1l242.4-99.8c9-3.7 14.8-12.4 14.8-22.1s-5.8-18.4-14.8-22.1L318.8 38.1C309 34.1 298.6 32 288 32s-21 2.1-30.8 6.1L14.8 137.9C5.8 141.6 0 150.3 0 160L0 456c0 13.3 10.7 24 24 24s24-10.7 24-24l0-260.2zm48 71.7L96 384c0 53 86 96 192 96s192-43 192-96l0-116.6-142.9 58.9c-15.6 6.4-32.2 9.7-49.1 9.7s-33.5-3.3-49.1-9.7L96 267.4z"/></svg>',"solid/heart":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"/></svg>',"solid/house":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M277.8 8.6c-12.3-11.4-31.3-11.4-43.5 0l-224 208c-9.6 9-12.8 22.9-8 35.1S18.8 272 32 272l16 0 0 176c0 35.3 28.7 64 64 64l288 0c35.3 0 64-28.7 64-64l0-176 16 0c13.2 0 25-8.1 29.8-20.3s1.6-26.2-8-35.1l-224-208zM240 320l32 0c26.5 0 48 21.5 48 48l0 96-128 0 0-96c0-26.5 21.5-48 48-48z"/></svg>',"solid/id-card":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M0 96C0 60.7 28.7 32 64 32l448 0c35.3 0 64 28.7 64 64L0 96zm0 48l576 0 0 272c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 144zM247.3 416c20.2 0 35.3-19.4 22.4-35-14.7-17.7-36.9-29-61.7-29l-64 0c-24.8 0-47 11.3-61.7 29-12.9 15.6 2.2 35 22.4 35l142.5 0zM176 312a56 56 0 1 0 0-112 56 56 0 1 0 0 112zM360 208c-13.3 0-24 10.7-24 24s10.7 24 24 24l112 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-112 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l112 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-112 0z"/></svg>',"solid/image":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm64 80a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM272 224c8.4 0 16.1 4.4 20.5 11.5l88 144c4.5 7.4 4.7 16.7 .5 24.3S368.7 416 360 416L88 416c-8.9 0-17.2-5-21.3-12.9s-3.5-17.5 1.6-24.8l56-80c4.5-6.4 11.8-10.2 19.7-10.2s15.2 3.8 19.7 10.2l26.4 37.8 61.4-100.5c4.4-7.1 12.1-11.5 20.5-11.5z"/></svg>',"solid/key":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0 160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17l0 80c0 13.3 10.7 24 24 24l80 0c13.3 0 24-10.7 24-24l0-40 40 0c13.3 0 24-10.7 24-24l0-40 40 0c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"/></svg>',"solid/language":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M160 0c17.7 0 32 14.3 32 32l0 32 128 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-9.6 0-8.4 23.1c-16.4 45.2-41.1 86.5-72.2 122 14.2 8.8 29 16.6 44.4 23.5l50.4 22.4 62.2-140c5.1-11.6 16.6-19 29.2-19s24.1 7.4 29.2 19l128 288c7.2 16.2-.1 35.1-16.2 42.2s-35.1-.1-42.2-16.2l-20-45-157.5 0-20 45c-7.2 16.2-26.1 23.4-42.2 16.2s-23.4-26.1-16.2-42.2l39.8-89.5-50.4-22.4c-23-10.2-45-22.4-65.8-36.4-21.3 17.2-44.6 32.2-69.5 44.7L78.3 380.6c-15.8 7.9-35 1.5-42.9-14.3s-1.5-35 14.3-42.9l34.5-17.3c16.3-8.2 31.8-17.7 46.4-28.3-13.8-12.7-26.8-26.4-38.9-40.9L81.6 224.7c-11.3-13.6-9.5-33.8 4.1-45.1s33.8-9.5 45.1 4.1l10.2 12.2c11.5 13.9 24.1 26.8 37.4 38.7 27.5-30.4 49.2-66.1 63.5-105.4l.5-1.2-210.3 0C14.3 128 0 113.7 0 96S14.3 64 32 64l96 0 0-32c0-17.7 14.3-32 32-32zM416 270.8L365.7 384 466.3 384 416 270.8z"/></svg>',"solid/lightbulb":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M292.9 384c7.3-22.3 21.9-42.5 38.4-59.9 32.7-34.4 52.7-80.9 52.7-132.1 0-106-86-192-192-192S0 86 0 192c0 51.2 20 97.7 52.7 132.1 16.5 17.4 31.2 37.6 38.4 59.9l201.7 0zM288 432l-192 0 0 16c0 44.2 35.8 80 80 80l32 0c44.2 0 80-35.8 80-80l0-16zM184 112c-39.8 0-72 32.2-72 72 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-66.3 53.7-120 120-120 13.3 0 24 10.7 24 24s-10.7 24-24 24z"/></svg>',"solid/link":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M419.5 96c-16.6 0-32.7 4.5-46.8 12.7-15.8-16-34.2-29.4-54.5-39.5 28.2-24 64.1-37.2 101.3-37.2 86.4 0 156.5 70 156.5 156.5 0 41.5-16.5 81.3-45.8 110.6l-71.1 71.1c-29.3 29.3-69.1 45.8-110.6 45.8-86.4 0-156.5-70-156.5-156.5 0-1.5 0-3 .1-4.5 .5-17.7 15.2-31.6 32.9-31.1s31.6 15.2 31.1 32.9c0 .9 0 1.8 0 2.6 0 51.1 41.4 92.5 92.5 92.5 24.5 0 48-9.7 65.4-27.1l71.1-71.1c17.3-17.3 27.1-40.9 27.1-65.4 0-51.1-41.4-92.5-92.5-92.5zM275.2 173.3c-1.9-.8-3.8-1.9-5.5-3.1-12.6-6.5-27-10.2-42.1-10.2-24.5 0-48 9.7-65.4 27.1L91.1 258.2c-17.3 17.3-27.1 40.9-27.1 65.4 0 51.1 41.4 92.5 92.5 92.5 16.5 0 32.6-4.4 46.7-12.6 15.8 16 34.2 29.4 54.6 39.5-28.2 23.9-64 37.2-101.3 37.2-86.4 0-156.5-70-156.5-156.5 0-41.5 16.5-81.3 45.8-110.6l71.1-71.1c29.3-29.3 69.1-45.8 110.6-45.8 86.6 0 156.5 70.6 156.5 156.9 0 1.3 0 2.6 0 3.9-.4 17.7-15.1 31.6-32.8 31.2s-31.6-15.1-31.2-32.8c0-.8 0-1.5 0-2.3 0-33.7-18-63.3-44.8-79.6z"/></svg>',"solid/list":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M40 48C26.7 48 16 58.7 16 72l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24L40 48zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM16 232l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0z"/></svg>',"solid/list-check":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M133.8 36.3c10.9 7.6 13.5 22.6 5.9 33.4l-56 80c-4.1 5.8-10.5 9.5-17.6 10.1S52 158 47 153L7 113C-2.3 103.6-2.3 88.4 7 79S31.6 69.7 41 79l19.8 19.8 39.6-56.6c7.6-10.9 22.6-13.5 33.4-5.9zm0 160c10.9 7.6 13.5 22.6 5.9 33.4l-56 80c-4.1 5.8-10.5 9.5-17.6 10.1S52 318 47 313L7 273c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l19.8 19.8 39.6-56.6c7.6-10.9 22.6-13.5 33.4-5.9zM224 96c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zm0 160c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zM160 416c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32zM64 376a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"/></svg>',"solid/list-ol":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 72C0 58.8 10.7 48 24 48l48 0c13.3 0 24 10.7 24 24l0 104 24 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-96 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l24 0 0-80-24 0C10.7 96 0 85.3 0 72zM30.4 301.2C41.8 292.6 55.7 288 70 288l4.9 0c33.7 0 61.1 27.4 61.1 61.1 0 19.6-9.4 37.9-25.2 49.4l-24 17.5 33.2 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-90.7 0C13.1 464 0 450.9 0 434.7 0 425.3 4.5 416.5 12.1 411l70.5-51.3c3.4-2.5 5.4-6.4 5.4-10.6 0-7.2-5.9-13.1-13.1-13.1L70 336c-3.9 0-7.7 1.3-10.8 3.6L38.4 355.2c-10.6 8-25.6 5.8-33.6-4.8S-1 324.8 9.6 316.8l20.8-15.6zM224 64l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>',"solid/list-ul":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M48 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM48 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM96 256a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/></svg>',"solid/location-dot":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M0 188.6C0 84.4 86 0 192 0S384 84.4 384 188.6c0 119.3-120.2 262.3-170.4 316.8-11.8 12.8-31.5 12.8-43.3 0-50.2-54.5-170.4-197.5-170.4-316.8zM192 256a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/></svg>',"solid/lock":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M128 96l0 64 128 0 0-64c0-35.3-28.7-64-64-64s-64 28.7-64 64zM64 160l0-64C64 25.3 121.3-32 192-32S320 25.3 320 96l0 64c35.3 0 64 28.7 64 64l0 224c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 224c0-35.3 28.7-64 64-64z"/></svg>',"solid/lock-open":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M384 96c0-35.3 28.7-64 64-64s64 28.7 64 64l0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-32c0-70.7-57.3-128-128-128S320 25.3 320 96l0 64-160 0c-35.3 0-64 28.7-64 64l0 224c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-224c0-35.3-28.7-64-64-64l-32 0 0-64z"/></svg>',"solid/magnifying-glass":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376C296.3 401.1 253.9 416 208 416 93.1 416 0 322.9 0 208S93.1 0 208 0 416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>',"solid/map":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M512 48c0-11.1-5.7-21.4-15.2-27.2s-21.2-6.4-31.1-1.4L349.5 77.5 170.1 17.6c-8.1-2.7-16.8-2.1-24.4 1.7l-128 64C6.8 88.8 0 99.9 0 112L0 464c0 11.1 5.7 21.4 15.2 27.2s21.2 6.4 31.1 1.4l116.1-58.1 179.4 59.8c8.1 2.7 16.8 2.1 24.4-1.7l128-64c10.8-5.4 17.7-16.5 17.7-28.6l0-352zM192 376.9l0-284.5 128 42.7 0 284.5-128-42.7z"/></svg>',"solid/microphone":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M192 0C139 0 96 43 96 96l0 128c0 53 43 96 96 96s96-43 96-96l0-128c0-53-43-96-96-96zM48 184c0-13.3-10.7-24-24-24S0 170.7 0 184l0 40c0 97.9 73.3 178.7 168 190.5l0 49.5-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-49.5c94.7-11.8 168-92.6 168-190.5l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c0 79.5-64.5 144-144 144S48 303.5 48 224l0-40z"/></svg>',"solid/minus":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32z"/></svg>',"solid/moon":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c68.8 0 131.3-27.2 177.3-71.4 7.3-7 9.4-17.9 5.3-27.1s-13.7-14.9-23.8-14.1c-4.9 .4-9.8 .6-14.8 .6-101.6 0-184-82.4-184-184 0-72.1 41.5-134.6 102.1-164.8 9.1-4.5 14.3-14.3 13.1-24.4S322.6 8.5 312.7 6.3C294.4 2.2 275.4 0 256 0z"/></svg>',"solid/newspaper":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 416L0 120c0-13.3 10.7-24 24-24s24 10.7 24 24l0 288c0 13.3 10.7 24 24 24s24-10.7 24-24L96 96c0-35.3 28.7-64 64-64l288 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64zM160 128l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32zm24 240c-13.3 0-24 10.7-24 24s10.7 24 24 24l240 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-240 0zm-24-72c0 13.3 10.7 24 24 24l240 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-240 0c-13.3 0-24 10.7-24 24zM360 176c-13.3 0-24 10.7-24 24s10.7 24 24 24l64 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-64 0z"/></svg>',"solid/palette":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M512 256c0 .9 0 1.8 0 2.7-.4 36.5-33.6 61.3-70.1 61.3L344 320c-26.5 0-48 21.5-48 48 0 3.4 .4 6.7 1 9.9 2.1 10.2 6.5 20 10.8 29.9 6.1 13.8 12.1 27.5 12.1 42 0 31.8-21.6 60.7-53.4 62-3.5 .1-7 .2-10.6 .2-141.4 0-256-114.6-256-256S114.6 0 256 0 512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',"solid/paperclip":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M224.6 12.8c56.2-56.2 147.4-56.2 203.6 0s56.2 147.4 0 203.6l-164 164c-34.4 34.4-90.1 34.4-124.5 0s-34.4-90.1 0-124.5L292.5 103.3c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L185 301.3c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l164-164c31.2-31.2 31.2-81.9 0-113.1s-81.9-31.2-113.1 0l-164 164c-53.1 53.1-53.1 139.2 0 192.3s139.2 53.1 192.3 0L428.3 284.3c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L343.4 459.6c-78.1 78.1-204.7 78.1-282.8 0s-78.1-204.7 0-282.8l164-164z"/></svg>',"solid/paper-plane":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M536.4-26.3c9.8-3.5 20.6-1 28 6.3s9.8 18.2 6.3 28l-178 496.9c-5 13.9-18.1 23.1-32.8 23.1-14.2 0-27-8.6-32.3-21.7l-64.2-158c-4.5-11-2.5-23.6 5.2-32.6l94.5-112.4c5.1-6.1 4.7-15-.9-20.6s-14.6-6-20.6-.9L229.2 276.1c-9.1 7.6-21.6 9.6-32.6 5.2L38.1 216.8c-13.1-5.3-21.7-18.1-21.7-32.3 0-14.7 9.2-27.8 23.1-32.8l496.9-178z"/></svg>',"solid/pause":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M48 32C21.5 32 0 53.5 0 80L0 432c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48L48 32zm224 0c-26.5 0-48 21.5-48 48l0 352c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48l-64 0z"/></svg>',"solid/pen":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M352.9 21.2L308 66.1 445.9 204 490.8 159.1C504.4 145.6 512 127.2 512 108s-7.6-37.6-21.2-51.1L455.1 21.2C441.6 7.6 423.2 0 404 0s-37.6 7.6-51.1 21.2zM274.1 100L58.9 315.1c-10.7 10.7-18.5 24.1-22.6 38.7L.9 481.6c-2.3 8.3 0 17.3 6.2 23.4s15.1 8.5 23.4 6.2l127.8-35.5c14.6-4.1 27.9-11.8 38.7-22.6L412 237.9 274.1 100z"/></svg>',"solid/pen-to-square":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L368 46.1 465.9 144 490.3 119.6c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L432 177.9 334.1 80 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"/></svg>',"solid/phone":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M160.2 25C152.3 6.1 131.7-3.9 112.1 1.4l-5.5 1.5c-64.6 17.6-119.8 80.2-103.7 156.4 37.1 175 174.8 312.7 349.8 349.8 76.3 16.2 138.8-39.1 156.4-103.7l1.5-5.5c5.4-19.7-4.7-40.3-23.5-48.1l-97.3-40.5c-16.5-6.9-35.6-2.1-47 11.8l-38.6 47.2C233.9 335.4 177.3 277 144.8 205.3L189 169.3c13.9-11.3 18.6-30.4 11.8-47L160.2 25z"/></svg>',"solid/play":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z"/></svg>',"solid/plus":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z"/></svg>',"solid/print":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 64C64 28.7 92.7 0 128 0L341.5 0c17 0 33.3 6.7 45.3 18.7l42.5 42.5c12 12 18.7 28.3 18.7 45.3l0 37.5-384 0 0-80zM0 256c0-35.3 28.7-64 64-64l384 0c35.3 0 64 28.7 64 64l0 96c0 17.7-14.3 32-32 32l-32 0 0 64c0 35.3-28.7 64-64 64l-256 0c-35.3 0-64-28.7-64-64l0-64-32 0c-17.7 0-32-14.3-32-32l0-96zM128 416l0 32 256 0 0-96-256 0 0 64zM456 272a24 24 0 1 0 -48 0 24 24 0 1 0 48 0z"/></svg>',"solid/right-from-bracket":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M505 273c9.4-9.4 9.4-24.6 0-33.9L361 95c-6.9-6.9-17.2-8.9-26.2-5.2S320 102.3 320 112l0 80-112 0c-26.5 0-48 21.5-48 48l0 32c0 26.5 21.5 48 48 48l112 0 0 80c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2L505 273zM160 96c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 32C43 32 0 75 0 128L0 384c0 53 43 96 96 96l64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l64 0z"/></svg>',"solid/right-to-bracket":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M345 273c9.4-9.4 9.4-24.6 0-33.9L201 95c-6.9-6.9-17.2-8.9-26.2-5.2S160 102.3 160 112l0 80-112 0c-26.5 0-48 21.5-48 48l0 32c0 26.5 21.5 48 48 48l112 0 0 80c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2L345 273zm7 143c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0c53 0 96-43 96-96l0-256c0-53-43-96-96-96l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0c17.7 0 32 14.3 32 32l0 256c0 17.7-14.3 32-32 32l-64 0z"/></svg>',"solid/rocket":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M128 320L24.5 320c-24.9 0-40.2-27.1-27.4-48.5L50 183.3C58.7 168.8 74.3 160 91.2 160l95 0c76.1-128.9 189.6-135.4 265.5-124.3 12.8 1.9 22.8 11.9 24.6 24.6 11.1 75.9 4.6 189.4-124.3 265.5l0 95c0 16.9-8.8 32.5-23.3 41.2l-88.2 52.9c-21.3 12.8-48.5-2.6-48.5-27.4L192 384c0-35.3-28.7-64-64-64l-.1 0zM400 160a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/></svg>',"solid/rotate-right":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M488 192l-144 0c-9.7 0-18.5-5.8-22.2-14.8s-1.7-19.3 5.2-26.2l46.7-46.7c-75.3-58.6-184.3-53.3-253.5 15.9-75 75-75 196.5 0 271.5s196.5 75 271.5 0c8.2-8.2 15.5-16.9 21.9-26.1 10.1-14.5 30.1-18 44.6-7.9s18 30.1 7.9 44.6c-8.5 12.2-18.2 23.8-29.1 34.7-100 100-262.1 100-362 0S-25 175 75 75c94.3-94.3 243.7-99.6 344.3-16.2L471 7c6.9-6.9 17.2-8.9 26.2-5.2S512 14.3 512 24l0 144c0 13.3-10.7 24-24 24z"/></svg>',"solid/share-nodes":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M384 192c53 0 96-43 96-96s-43-96-96-96-96 43-96 96c0 5.4 .5 10.8 1.3 16L159.6 184.1c-16.9-15-39.2-24.1-63.6-24.1-53 0-96 43-96 96s43 96 96 96c24.4 0 46.6-9.1 63.6-24.1L289.3 400c-.9 5.2-1.3 10.5-1.3 16 0 53 43 96 96 96s96-43 96-96-43-96-96-96c-24.4 0-46.6 9.1-63.6 24.1L190.7 272c.9-5.2 1.3-10.5 1.3-16s-.5-10.8-1.3-16l129.7-72.1c16.9 15 39.2 24.1 63.6 24.1z"/></svg>',"solid/shield-halved":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 0c4.6 0 9.2 1 13.4 2.9L457.8 82.8c22 9.3 38.4 31 38.3 57.2-.5 99.2-41.3 280.7-213.6 363.2-16.7 8-36.1 8-52.8 0-172.4-82.5-213.1-264-213.6-363.2-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.9 1 251.4 0 256 0zm0 66.8l0 378.1c138-66.8 175.1-214.8 176-303.4l-176-74.6 0 0z"/></svg>',"solid/sliders":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M32 64C14.3 64 0 78.3 0 96s14.3 32 32 32l86.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 128c17.7 0 32-14.3 32-32s-14.3-32-32-32L265.3 64C253 35.7 224.8 16 192 16s-61 19.7-73.3 48L32 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l246.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48l54.7 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-54.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 224zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l54.7 0c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48L480 448c17.7 0 32-14.3 32-32s-14.3-32-32-32l-246.7 0c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48L32 384z"/></svg>',"solid/spinner":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M208 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm0 416a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM48 208a48 48 0 1 1 0 96 48 48 0 1 1 0-96zm368 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM75 369.1A48 48 0 1 1 142.9 437 48 48 0 1 1 75 369.1zM75 75A48 48 0 1 1 142.9 142.9 48 48 0 1 1 75 75zM437 369.1A48 48 0 1 1 369.1 437 48 48 0 1 1 437 369.1z"/></svg>',"solid/star":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M309.5-18.9c-4.1-8-12.4-13.1-21.4-13.1s-17.3 5.1-21.4 13.1L193.1 125.3 33.2 150.7c-8.9 1.4-16.3 7.7-19.1 16.3s-.5 18 5.8 24.4l114.4 114.5-25.2 159.9c-1.4 8.9 2.3 17.9 9.6 23.2s16.9 6.1 25 2L288.1 417.6 432.4 491c8 4.1 17.7 3.3 25-2s11-14.2 9.6-23.2L441.7 305.9 556.1 191.4c6.4-6.4 8.6-15.8 5.8-24.4s-10.1-14.9-19.1-16.3L383 125.3 309.5-18.9z"/></svg>',"solid/sun":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M288-32c8.4 0 16.3 4.4 20.6 11.7L364.1 72.3 468.9 46c8.2-2 16.9 .4 22.8 6.3S500 67 498 75.1l-26.3 104.7 92.7 55.5c7.2 4.3 11.7 12.2 11.7 20.6s-4.4 16.3-11.7 20.6L471.7 332.1 498 436.8c2 8.2-.4 16.9-6.3 22.8S477 468 468.9 466l-104.7-26.3-55.5 92.7c-4.3 7.2-12.2 11.7-20.6 11.7s-16.3-4.4-20.6-11.7L211.9 439.7 107.2 466c-8.2 2-16.8-.4-22.8-6.3S76 445 78 436.8l26.2-104.7-92.6-55.5C4.4 272.2 0 264.4 0 256s4.4-16.3 11.7-20.6L104.3 179.9 78 75.1c-2-8.2 .3-16.8 6.3-22.8S99 44 107.2 46l104.7 26.2 55.5-92.6 1.8-2.6c4.5-5.7 11.4-9.1 18.8-9.1zm0 144a144 144 0 1 0 0 288 144 144 0 1 0 0-288zm0 240a96 96 0 1 1 0-192 96 96 0 1 1 0 192z"/></svg>',"solid/table":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M384 32c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64l-320 0-6.5-.3C25.2 476.4 0 449.1 0 416L0 96C0 60.7 28.7 32 64 32l320 0zM64 320l0 96 128 0 0-96-128 0zm192 0l0 96 128 0 0-96-128 0zM64 256l128 0 0-96-128 0 0 96zm192 0l128 0 0-96-128 0 0 96z"/></svg>',"solid/tag":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M32.5 96l0 149.5c0 17 6.7 33.3 18.7 45.3l192 192c25 25 65.5 25 90.5 0L483.2 333.3c25-25 25-65.5 0-90.5l-192-192C279.2 38.7 263 32 246 32L96.5 32c-35.3 0-64 28.7-64 64zm112 16a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',"solid/thumbs-down":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M384 32c26.5 0 48 21.5 48 48 0 6.3-1.3 12.2-3.4 17.7 20.4 5.5 35.4 24.1 35.4 46.3 0 9.1-2.6 17.6-7 24.9 22.2 4.2 39 23.7 39 47.1 0 19.7-11.9 36.6-28.9 44 17 7.4 28.9 24.3 28.9 44 0 26.5-21.5 48-48 48l-160 0 28.2 70.4c2.5 6.3 3.8 13.1 3.8 19.9l0 4.2c0 27.3-22.1 49.4-49.4 49.4-18.7 0-35.8-10.6-44.2-27.3L170.1 356.3c-6.7-13.3-10.1-28-10.1-42.9l0-186.6c0-19.4 8.9-37.8 24-50l12.2-9.7C224.6 44.4 259.8 32 296.1 32L384 32zM80 96c17.7 0 32 14.3 32 32l0 256c0 17.7-14.3 32-32 32l-48 0c-17.7 0-32-14.3-32-32L0 128c0-17.7 14.3-32 32-32l48 0z"/></svg>',"solid/thumbs-up":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M80 160c17.7 0 32 14.3 32 32l0 256c0 17.7-14.3 32-32 32l-48 0c-17.7 0-32-14.3-32-32L0 192c0-17.7 14.3-32 32-32l48 0zM270.6 16C297.9 16 320 38.1 320 65.4l0 4.2c0 6.8-1.3 13.6-3.8 19.9L288 160 448 160c26.5 0 48 21.5 48 48 0 19.7-11.9 36.6-28.9 44 17 7.4 28.9 24.3 28.9 44 0 23.4-16.8 42.9-39 47.1 4.4 7.3 7 15.8 7 24.9 0 22.2-15 40.8-35.4 46.3 2.2 5.5 3.4 11.5 3.4 17.7 0 26.5-21.5 48-48 48l-87.9 0c-36.3 0-71.6-12.4-99.9-35.1L184 435.2c-15.2-12.1-24-30.5-24-50l0-186.6c0-14.9 3.5-29.6 10.1-42.9L226.3 43.3C234.7 26.6 251.8 16 270.6 16z"/></svg>',"solid/trash-can":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M136.7 5.9C141.1-7.2 153.3-16 167.1-16l113.9 0c13.8 0 26 8.8 30.4 21.9L320 32 416 32c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 8.7-26.1zM32 144l384 0 0 304c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-304zm88 64c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24z"/></svg>',"solid/triangle-exclamation":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 0c14.7 0 28.2 8.1 35.2 21l216 400c6.7 12.4 6.4 27.4-.8 39.5S486.1 480 472 480L40 480c-14.1 0-27.2-7.4-34.4-19.5s-7.5-27.1-.8-39.5l216-400c7-12.9 20.5-21 35.2-21zm0 352a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.5 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"/></svg>',"solid/truck":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M0 96C0 60.7 28.7 32 64 32l288 0c35.3 0 64 28.7 64 64l0 32 50.7 0c17 0 33.3 6.7 45.3 18.7L557.3 192c12 12 18.7 28.3 18.7 45.3L576 384c0 35.3-28.7 64-64 64l-3.3 0c-10.4 36.9-44.4 64-84.7 64s-74.2-27.1-84.7-64l-102.6 0c-10.4 36.9-44.4 64-84.7 64s-74.2-27.1-84.7-64L64 448c-35.3 0-64-28.7-64-64L0 96zM512 288l0-50.7-45.3-45.3-50.7 0 0 96 96 0zM192 424a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm232 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"/></svg>',"solid/upload":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M256 109.3L256 320c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-210.7-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 109.3zM224 400c44.2 0 80-35.8 80-80l80 0c35.3 0 64 28.7 64 64l0 32c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64l0-32c0-35.3 28.7-64 64-64l80 0c0 44.2 35.8 80 80 80zm144 24a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>',"solid/user":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M224 248a120 120 0 1 0 0-240 120 120 0 1 0 0 240zm-29.7 56C95.8 304 16 383.8 16 482.3 16 498.7 29.3 512 45.7 512l356.6 0c16.4 0 29.7-13.3 29.7-29.7 0-98.5-79.8-178.3-178.3-178.3l-59.4 0z"/></svg>',"solid/users":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M320 16a104 104 0 1 1 0 208 104 104 0 1 1 0-208zM96 88a72 72 0 1 1 0 144 72 72 0 1 1 0-144zM0 416c0-70.7 57.3-128 128-128 12.8 0 25.2 1.9 36.9 5.4-32.9 36.8-52.9 85.4-52.9 138.6l0 16c0 11.4 2.4 22.2 6.7 32L32 480c-17.7 0-32-14.3-32-32l0-32zm521.3 64c4.3-9.8 6.7-20.6 6.7-32l0-16c0-53.2-20-101.8-52.9-138.6 11.7-3.5 24.1-5.4 36.9-5.4 70.7 0 128 57.3 128 128l0 32c0 17.7-14.3 32-32 32l-86.7 0zM472 160a72 72 0 1 1 144 0 72 72 0 1 1 -144 0zM160 432c0-88.4 71.6-160 160-160s160 71.6 160 160l0 16c0 17.7-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32l0-16z"/></svg>',"solid/video":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M96 64c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L96 64zM464 336l73.5 58.8c4.2 3.4 9.4 5.2 14.8 5.2 13.1 0 23.7-10.6 23.7-23.7l0-240.6c0-13.1-10.6-23.7-23.7-23.7-5.4 0-10.6 1.8-14.8 5.2L464 176 464 336z"/></svg>',"solid/wallet":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-192c0-35.3-28.7-64-64-64L72 128c-13.3 0-24-10.7-24-24S58.7 80 72 80l384 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L64 32zM416 256a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',"solid/wrench":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M509.4 98.6c7.6-7.6 20.3-5.7 24.1 4.3 6.8 17.7 10.5 37 10.5 57.1 0 88.4-71.6 160-160 160-17.5 0-34.4-2.8-50.2-8L146.9 498.9c-28.1 28.1-73.7 28.1-101.8 0s-28.1-73.7 0-101.8L232 210.2c-5.2-15.8-8-32.6-8-50.2 0-88.4 71.6-160 160-160 20.1 0 39.4 3.7 57.1 10.5 10 3.8 11.8 16.5 4.3 24.1l-88.7 88.7c-3 3-4.7 7.1-4.7 11.3l0 41.4c0 8.8 7.2 16 16 16l41.4 0c4.2 0 8.3-1.7 11.3-4.7l88.7-88.7z"/></svg>',"solid/xmark":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/></svg>',"brands/apple":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M319.1 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7-55.8 .9-115.1 44.5-115.1 133.2 0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM262.5 104.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>',"brands/discord":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M492.5 69.8c-.2-.3-.4-.6-.8-.7-38.1-17.5-78.4-30-119.7-37.1-.4-.1-.8 0-1.1 .1s-.6 .4-.8 .8c-5.5 9.9-10.5 20.2-14.9 30.6-44.6-6.8-89.9-6.8-134.4 0-4.5-10.5-9.5-20.7-15.1-30.6-.2-.3-.5-.6-.8-.8s-.7-.2-1.1-.2c-41.3 7.1-81.6 19.6-119.7 37.1-.3 .1-.6 .4-.8 .7-76.2 113.8-97.1 224.9-86.9 334.5 0 .3 .1 .5 .2 .8s.3 .4 .5 .6c44.4 32.9 94 58 146.8 74.2 .4 .1 .8 .1 1.1 0s.7-.4 .9-.7c11.3-15.4 21.4-31.8 30-48.8 .1-.2 .2-.5 .2-.8s0-.5-.1-.8-.2-.5-.4-.6-.4-.3-.7-.4c-15.8-6.1-31.2-13.4-45.9-21.9-.3-.2-.5-.4-.7-.6s-.3-.6-.3-.9 0-.6 .2-.9 .3-.5 .6-.7c3.1-2.3 6.2-4.7 9.1-7.1 .3-.2 .6-.4 .9-.4s.7 0 1 .1c96.2 43.9 200.4 43.9 295.5 0 .3-.1 .7-.2 1-.2s.7 .2 .9 .4c2.9 2.4 6 4.9 9.1 7.2 .2 .2 .4 .4 .6 .7s.2 .6 .2 .9-.1 .6-.3 .9-.4 .5-.6 .6c-14.7 8.6-30 15.9-45.9 21.8-.2 .1-.5 .2-.7 .4s-.3 .4-.4 .7-.1 .5-.1 .8 .1 .5 .2 .8c8.8 17 18.8 33.3 30 48.8 .2 .3 .6 .6 .9 .7s.8 .1 1.1 0c52.9-16.2 102.6-41.3 147.1-74.2 .2-.2 .4-.4 .5-.6s.2-.5 .2-.8c12.3-126.8-20.5-236.9-86.9-334.5zm-302 267.7c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.4 59.2-52.8 59.2zm195.4 0c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.2 59.2-52.8 59.2z"/></svg>',"brands/facebook":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5l0-170.3-52.8 0 0-78.2 52.8 0 0-33.7c0-87.1 39.4-127.5 125-127.5 16.2 0 44.2 3.2 55.7 6.4l0 70.8c-6-.6-16.5-1-29.6-1-42 0-58.2 15.9-58.2 57.2l0 27.8 83.6 0-14.4 78.2-69.3 0 0 175.9C413.8 494.8 512 386.9 512 256z"/></svg>',"brands/figma":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M14 95.8C14 42.9 56.9 0 109.8 0L274.2 0c52.9 0 95.8 42.9 95.8 95.8 0 33.5-17.2 63-43.2 80.1 26 17.1 43.2 46.6 43.2 80.1 0 52.9-42.9 95.8-95.8 95.8l-2.1 0c-24.8 0-47.4-9.4-64.4-24.9l0 88.3c0 53.6-44 96.8-97.4 96.8-52.8 0-96.3-42.8-96.3-95.8 0-33.5 17.2-63 43.2-80.1-26-17.1-43.2-46.6-43.2-80.1s17.2-63 43.2-80.1C31.2 158.8 14 129.3 14 95.8zm162.3 95.8l-66.5 0c-35.6 0-64.4 28.8-64.4 64.4 0 35.4 28.6 64.2 64 64.4l66.9 0 0-128.8zM207.7 256c0 35.6 28.8 64.4 64.4 64.4l2.1 0c35.6 0 64.4-28.8 64.4-64.4s-28.8-64.4-64.4-64.4l-2.1 0c-35.6 0-64.4 28.8-64.4 64.4zm-97.9 95.8l-.4 0c-35.4 .2-64 29-64 64.4s29.2 64.4 64.9 64.4c36.3 0 66-29.4 66-65.5l0-63.4-66.5 0zm0-320.4c-35.6 0-64.4 28.8-64.4 64.4s28.8 64.4 64.4 64.4l66.5 0 0-128.8-66.5 0zm97.9 128.8l66.5 0c35.6 0 64.4-28.8 64.4-64.4s-28.8-64.4-64.4-64.4l-66.5 0 0 128.8z"/></svg>',"brands/github":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M216.5 362.5c-66-8-112.5-55.5-112.5-117 0-25 9-52 24-70-6.5-16.5-5.5-51.5 2-66 20-2.5 47 8 63 22.5 19-6 39-9 63.5-9s44.5 3 62.5 8.5c15.5-14 43-24.5 63-22 7 13.5 8 48.5 1.5 65.5 16 19 24.5 44.5 24.5 70.5 0 61.5-46.5 108-113.5 116.5 17 11 28.5 35 28.5 62.5l0 52C323 491.5 335.5 500 350.5 494 441 459.5 512 369 512 257 512 115.5 397 0 255.5 0S0 115.5 0 257c0 111 70.5 203 165.5 237.5 13.5 5 26.5-4 26.5-17.5l0-40c-7 3-16 5-24 5-33 0-52.5-18-66.5-51.5-5.5-13.5-11.5-21.5-23-23-6-.5-8-3-8-6 0-6 10-10.5 20-10.5 14.5 0 27 9 40 27.5 10 14.5 20.5 21 33 21s20.5-4.5 32-16c8.5-8.5 15-16 21-21z"/></svg>',"brands/google":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M500 261.8C500 403.3 403.1 504 260 504 122.8 504 12 393.2 12 256S122.8 8 260 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9c-88.3-85.2-252.5-21.2-252.5 118.2 0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9l-140.8 0 0-85.3 236.1 0c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>',"brands/instagram":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M224.3 141a115 115 0 1 0 -.6 230 115 115 0 1 0 .6-230zm-.6 40.4a74.6 74.6 0 1 1 .6 149.2 74.6 74.6 0 1 1 -.6-149.2zm93.4-45.1a26.8 26.8 0 1 1 53.6 0 26.8 26.8 0 1 1 -53.6 0zm129.7 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM399 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>',"brands/linkedin":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M416 32L31.9 32C14.3 32 0 46.5 0 64.3L0 447.7C0 465.5 14.3 480 31.9 480L416 480c17.6 0 32-14.5 32-32.3l0-383.4C448 46.5 433.6 32 416 32zM135.4 416l-66.4 0 0-213.8 66.5 0 0 213.8-.1 0zM102.2 96a38.5 38.5 0 1 1 0 77 38.5 38.5 0 1 1 0-77zM384.3 416l-66.4 0 0-104c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9l0 105.8-66.4 0 0-213.8 63.7 0 0 29.2 .9 0c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9l0 117.2z"/></svg>',"brands/microsoft":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 32l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6zM0 265.4l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6z"/></svg>',"brands/slack":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M94.1 315.1c0 25.9-21.2 47.1-47.1 47.1S0 341 0 315.1 21.2 268 47.1 268l47.1 0 0 47.1zm23.7 0c0-25.9 21.2-47.1 47.1-47.1S212 289.2 212 315.1l0 117.8c0 25.9-21.2 47.1-47.1 47.1s-47.1-21.2-47.1-47.1l0-117.8zm47.1-189c-25.9 0-47.1-21.2-47.1-47.1S139 32 164.9 32 212 53.2 212 79.1l0 47.1-47.1 0zm0 23.7c25.9 0 47.1 21.2 47.1 47.1S190.8 244 164.9 244L47.1 244C21.2 244 0 222.8 0 196.9s21.2-47.1 47.1-47.1l117.8 0zm189 47.1c0-25.9 21.2-47.1 47.1-47.1S448 171 448 196.9 426.8 244 400.9 244l-47.1 0 0-47.1zm-23.7 0c0 25.9-21.2 47.1-47.1 47.1S236 222.8 236 196.9l0-117.8C236 53.2 257.2 32 283.1 32s47.1 21.2 47.1 47.1l0 117.8zm-47.1 189c25.9 0 47.1 21.2 47.1 47.1S309 480 283.1 480 236 458.8 236 432.9l0-47.1 47.1 0zm0-23.7c-25.9 0-47.1-21.2-47.1-47.1S257.2 268 283.1 268l117.8 0c25.9 0 47.1 21.2 47.1 47.1s-21.2 47.1-47.1 47.1l-117.8 0z"/></svg>',"brands/whatsapp":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M380.9 97.1c-41.9-42-97.7-65.1-157-65.1-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480 117.7 449.1c32.4 17.7 68.9 27 106.1 27l.1 0c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1s56.2 81.2 56.1 130.5c0 101.8-84.9 184.6-186.6 184.6zM325.1 300.5c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7s-12.5-30.1-17.1-41.2c-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4s4.6-24.1 3.2-26.4c-1.3-2.5-5-3.9-10.5-6.6z"/></svg>',"brands/x-twitter":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M357.2 48L427.8 48 273.6 224.2 455 464 313 464 201.7 318.6 74.5 464 3.8 464 168.7 275.5-5.2 48 140.4 48 240.9 180.9 357.2 48zM332.4 421.8l39.1 0-252.4-333.8-42 0 255.3 333.8z"/></svg>',"brands/youtube":'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M549.7 124.1C543.5 100.4 524.9 81.8 501.4 75.5 458.9 64 288.1 64 288.1 64S117.3 64 74.7 75.5C51.2 81.8 32.7 100.4 26.4 124.1 15 167 15 256.4 15 256.4s0 89.4 11.4 132.3c6.3 23.6 24.8 41.5 48.3 47.8 42.6 11.5 213.4 11.5 213.4 11.5s170.8 0 213.4-11.5c23.5-6.3 42-24.2 48.3-47.8 11.4-42.9 11.4-132.3 11.4-132.3s0-89.4-11.4-132.3zM232.2 337.6l0-162.4 142.7 81.2-142.7 81.2z"/></svg>'};sa("default",{resolver:dh(Mm),mutator:t=>{t.hasAttribute("fill")||t.setAttribute("fill","currentColor")}});export{km as allDefined,Br as discover,_p as getAnimationNames,oa as getBasePath,na as getDefaultIconFamily,Tp as getEasingNames,Gs as getIconFolder,ia as getIconPath,ra as getKitCode,$m as preventTurboFouce,sa as registerIconLibrary,Uo as registerTranslation,Sm as serialize,ea as setBasePath,Oh as setDefaultIconFamily,Mh as setIconPath,Xs as setKitCode,zm as startLoader,Em as stopLoader,on as unregisterIconLibrary};
/*! Font Awesome Free 7.x by @fontawesome — Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License. Copyright Fonticons, Inc. */
/*! Bundled license information:

@awesome.me/webawesome/dist/chunks/chunk.T6GGTYHD.js:
@awesome.me/webawesome/dist/chunks/chunk.ZZPJSMJ4.js:
@awesome.me/webawesome/dist/chunks/chunk.VO4OKF3D.js:
@awesome.me/webawesome/dist/chunks/chunk.MF234WAF.js:
@awesome.me/webawesome/dist/chunks/chunk.AFGZQYUZ.js:
@awesome.me/webawesome/dist/chunks/chunk.PZAN6FPN.js:
@awesome.me/webawesome/dist/chunks/chunk.7VGCIHDG.js:
@awesome.me/webawesome/dist/chunks/chunk.AOKMSJXD.js:
@awesome.me/webawesome/dist/chunks/chunk.M7WYH4DO.js:
@awesome.me/webawesome/dist/chunks/chunk.4MQTK254.js:
@awesome.me/webawesome/dist/chunks/chunk.M7O5VY4E.js:
@awesome.me/webawesome/dist/chunks/chunk.NSSMHWNA.js:
@awesome.me/webawesome/dist/chunks/chunk.F25QOBDY.js:
@awesome.me/webawesome/dist/chunks/chunk.L6CIKOFQ.js:
@awesome.me/webawesome/dist/chunks/chunk.KQHZRDPB.js:
@awesome.me/webawesome/dist/chunks/chunk.56IHH3HP.js:
@awesome.me/webawesome/dist/chunks/chunk.QAR32T43.js:
@awesome.me/webawesome/dist/chunks/chunk.EE6KNCDS.js:
@awesome.me/webawesome/dist/chunks/chunk.YDQCS2HK.js:
@awesome.me/webawesome/dist/chunks/chunk.WDIIGUNP.js:
@awesome.me/webawesome/dist/chunks/chunk.O74G5RVH.js:
@awesome.me/webawesome/dist/chunks/chunk.HGBRCPUS.js:
@awesome.me/webawesome/dist/chunks/chunk.KKI7M5DP.js:
@awesome.me/webawesome/dist/chunks/chunk.LDM2MW63.js:
@awesome.me/webawesome/dist/chunks/chunk.W7QZX2CB.js:
@awesome.me/webawesome/dist/chunks/chunk.ZCZ2WKQR.js:
@awesome.me/webawesome/dist/components/accordion/accordion.js:
@awesome.me/webawesome/dist/components/accordion-item/accordion-item.js:
@awesome.me/webawesome/dist/chunks/chunk.SJ4PCSIY.js:
@awesome.me/webawesome/dist/chunks/chunk.FJFDVGII.js:
@awesome.me/webawesome/dist/components/animated-image/animated-image.js:
@awesome.me/webawesome/dist/chunks/chunk.BMO76VKZ.js:
@awesome.me/webawesome/dist/chunks/chunk.IIHGIRPB.js:
@awesome.me/webawesome/dist/chunks/chunk.ZT4OZS6F.js:
@awesome.me/webawesome/dist/chunks/chunk.Z4HIBJYN.js:
@awesome.me/webawesome/dist/chunks/chunk.46TQDRI6.js:
@awesome.me/webawesome/dist/chunks/chunk.XPHVZY5X.js:
@awesome.me/webawesome/dist/components/animation/animation.js:
@awesome.me/webawesome/dist/chunks/chunk.YUS4MAP3.js:
@awesome.me/webawesome/dist/chunks/chunk.NTVW7E2R.js:
@awesome.me/webawesome/dist/components/avatar/avatar.js:
@awesome.me/webawesome/dist/chunks/chunk.XNTP7DEQ.js:
@awesome.me/webawesome/dist/chunks/chunk.SUWP4C7R.js:
@awesome.me/webawesome/dist/chunks/chunk.EVUNHVNL.js:
@awesome.me/webawesome/dist/components/badge/badge.js:
@awesome.me/webawesome/dist/chunks/chunk.2LJGR6KY.js:
@awesome.me/webawesome/dist/chunks/chunk.UFQXLTF7.js:
@awesome.me/webawesome/dist/components/breadcrumb/breadcrumb.js:
@awesome.me/webawesome/dist/chunks/chunk.OJKMQ4H5.js:
@awesome.me/webawesome/dist/chunks/chunk.OHAZ63I6.js:
@awesome.me/webawesome/dist/components/breadcrumb-item/breadcrumb-item.js:
@awesome.me/webawesome/dist/chunks/chunk.R7QX4M6R.js:
@awesome.me/webawesome/dist/chunks/chunk.VC3BPUZJ.js:
@awesome.me/webawesome/dist/chunks/chunk.KBXNFZQL.js:
@awesome.me/webawesome/dist/chunks/chunk.RWNXKUCF.js:
@awesome.me/webawesome/dist/chunks/chunk.3CFUTVFX.js:
@awesome.me/webawesome/dist/chunks/chunk.RPQJAXXR.js:
@awesome.me/webawesome/dist/chunks/chunk.G5ZZIGWB.js:
@awesome.me/webawesome/dist/chunks/chunk.AFPI375Q.js:
@awesome.me/webawesome/dist/chunks/chunk.W7A2VLCT.js:
@awesome.me/webawesome/dist/chunks/chunk.DVA7QY5T.js:
@awesome.me/webawesome/dist/components/button/button.js:
@awesome.me/webawesome/dist/chunks/chunk.CB2JRBWR.js:
@awesome.me/webawesome/dist/chunks/chunk.KFCTFBMF.js:
@awesome.me/webawesome/dist/components/button-group/button-group.js:
@awesome.me/webawesome/dist/chunks/chunk.LCEGCF5S.js:
@awesome.me/webawesome/dist/chunks/chunk.4DBVVTNI.js:
@awesome.me/webawesome/dist/components/callout/callout.js:
@awesome.me/webawesome/dist/chunks/chunk.ATI2KDM5.js:
@awesome.me/webawesome/dist/chunks/chunk.S37D42WK.js:
@awesome.me/webawesome/dist/components/card/card.js:
@awesome.me/webawesome/dist/chunks/chunk.EF25YJJE.js:
@awesome.me/webawesome/dist/chunks/chunk.KNJT7KBU.js:
@awesome.me/webawesome/dist/chunks/chunk.6SNQOYNK.js:
@awesome.me/webawesome/dist/chunks/chunk.QKNGDOON.js:
@awesome.me/webawesome/dist/chunks/chunk.M2L7ZIHM.js:
@awesome.me/webawesome/dist/components/carousel/carousel.js:
@awesome.me/webawesome/dist/chunks/chunk.QIYW4R5Z.js:
@awesome.me/webawesome/dist/chunks/chunk.IADD4USH.js:
@awesome.me/webawesome/dist/components/carousel-item/carousel-item.js:
@awesome.me/webawesome/dist/chunks/chunk.YB6263IP.js:
@awesome.me/webawesome/dist/chunks/chunk.GWSUX3V5.js:
@awesome.me/webawesome/dist/chunks/chunk.5LXXXELE.js:
@awesome.me/webawesome/dist/chunks/chunk.BNDX6UGP.js:
@awesome.me/webawesome/dist/components/checkbox/checkbox.js:
@awesome.me/webawesome/dist/chunks/chunk.D4WM2KLE.js:
@awesome.me/webawesome/dist/chunks/chunk.HMOGMUA6.js:
@awesome.me/webawesome/dist/components/checkbox-group/checkbox-group.js:
@awesome.me/webawesome/dist/chunks/chunk.WYNTFJHW.js:
@awesome.me/webawesome/dist/chunks/chunk.2ZAJEMB4.js:
@awesome.me/webawesome/dist/chunks/chunk.52WA2DJO.js:
@awesome.me/webawesome/dist/chunks/chunk.X5AP4FED.js:
@awesome.me/webawesome/dist/chunks/chunk.D3LNSKD6.js:
@awesome.me/webawesome/dist/chunks/chunk.JTOY5KP3.js:
@awesome.me/webawesome/dist/chunks/chunk.NUVDWQN5.js:
@awesome.me/webawesome/dist/chunks/chunk.I2BZQ4AT.js:
@awesome.me/webawesome/dist/chunks/chunk.A65YRABB.js:
@awesome.me/webawesome/dist/chunks/chunk.ZWQCGLB5.js:
@awesome.me/webawesome/dist/chunks/chunk.HS5AYC6E.js:
@awesome.me/webawesome/dist/chunks/chunk.64OG2H45.js:
@awesome.me/webawesome/dist/components/color-picker/color-picker.js:
@awesome.me/webawesome/dist/chunks/chunk.X5P46BFE.js:
@awesome.me/webawesome/dist/chunks/chunk.66LZPHA4.js:
@awesome.me/webawesome/dist/components/comparison/comparison.js:
@awesome.me/webawesome/dist/chunks/chunk.NY2PQ35L.js:
@awesome.me/webawesome/dist/chunks/chunk.YQNBAO2Z.js:
@awesome.me/webawesome/dist/chunks/chunk.YDWBRJAR.js:
@awesome.me/webawesome/dist/chunks/chunk.QPABUBVS.js:
@awesome.me/webawesome/dist/chunks/chunk.DJLBC7Q4.js:
@awesome.me/webawesome/dist/chunks/chunk.4ZAKP7NY.js:
@awesome.me/webawesome/dist/chunks/chunk.MQODJ75V.js:
@awesome.me/webawesome/dist/chunks/chunk.PX3HMKF7.js:
@awesome.me/webawesome/dist/chunks/chunk.3NKIHICW.js:
@awesome.me/webawesome/dist/chunks/chunk.IHLP7D3G.js:
@awesome.me/webawesome/dist/components/copy-button/copy-button.js:
@awesome.me/webawesome/dist/chunks/chunk.W62SLQ7P.js:
@awesome.me/webawesome/dist/chunks/chunk.FX4SWCO7.js:
@awesome.me/webawesome/dist/components/details/details.js:
@awesome.me/webawesome/dist/chunks/chunk.HKHINDC2.js:
@awesome.me/webawesome/dist/chunks/chunk.VQZ46MYI.js:
@awesome.me/webawesome/dist/chunks/chunk.RMZ7BVDM.js:
@awesome.me/webawesome/dist/chunks/chunk.XTG2LNFG.js:
@awesome.me/webawesome/dist/chunks/chunk.TP2XMZK6.js:
@awesome.me/webawesome/dist/components/dialog/dialog.js:
@awesome.me/webawesome/dist/chunks/chunk.CZSN7KEZ.js:
@awesome.me/webawesome/dist/chunks/chunk.P6YH3RDQ.js:
@awesome.me/webawesome/dist/components/divider/divider.js:
@awesome.me/webawesome/dist/chunks/chunk.LVP7MDLV.js:
@awesome.me/webawesome/dist/chunks/chunk.N6ERLD6S.js:
@awesome.me/webawesome/dist/components/drawer/drawer.js:
@awesome.me/webawesome/dist/chunks/chunk.2LXKNNNE.js:
@awesome.me/webawesome/dist/chunks/chunk.4LIBWWJL.js:
@awesome.me/webawesome/dist/chunks/chunk.Z6IK7DP4.js:
@awesome.me/webawesome/dist/chunks/chunk.OLYEKNQ3.js:
@awesome.me/webawesome/dist/chunks/chunk.VCKA3KNZ.js:
@awesome.me/webawesome/dist/chunks/chunk.CS7NVNXE.js:
@awesome.me/webawesome/dist/components/dropdown/dropdown.js:
@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js:
@awesome.me/webawesome/dist/chunks/chunk.TNDZ6JBP.js:
@awesome.me/webawesome/dist/components/format-bytes/format-bytes.js:
@awesome.me/webawesome/dist/chunks/chunk.GFFXT5KM.js:
@awesome.me/webawesome/dist/components/format-date/format-date.js:
@awesome.me/webawesome/dist/chunks/chunk.XSDZBUYM.js:
@awesome.me/webawesome/dist/components/format-number/format-number.js:
@awesome.me/webawesome/dist/components/icon/icon.js:
@awesome.me/webawesome/dist/chunks/chunk.H7TA73OO.js:
@awesome.me/webawesome/dist/chunks/chunk.2MLO7LVV.js:
@awesome.me/webawesome/dist/chunks/chunk.WGFDW2LC.js:
@awesome.me/webawesome/dist/chunks/chunk.ZWODNT3Q.js:
@awesome.me/webawesome/dist/components/include/include.js:
@awesome.me/webawesome/dist/components/input/input.js:
@awesome.me/webawesome/dist/chunks/chunk.XZPLJ4VW.js:
@awesome.me/webawesome/dist/chunks/chunk.RZQFDTS2.js:
@awesome.me/webawesome/dist/chunks/chunk.D2LFBIUE.js:
@awesome.me/webawesome/dist/components/intersection-observer/intersection-observer.js:
@awesome.me/webawesome/dist/chunks/chunk.TDR7XG37.js:
@awesome.me/webawesome/dist/chunks/chunk.ICDCAGCX.js:
@awesome.me/webawesome/dist/chunks/chunk.6TNHHCAM.js:
@awesome.me/webawesome/dist/chunks/chunk.YUTC5OH2.js:
@awesome.me/webawesome/dist/chunks/chunk.3YF6WWOR.js:
@awesome.me/webawesome/dist/components/known-date/known-date.js:
@awesome.me/webawesome/dist/chunks/chunk.SJQAU36I.js:
@awesome.me/webawesome/dist/chunks/chunk.HDPFPOLR.js:
@awesome.me/webawesome/dist/components/markdown/markdown.js:
@awesome.me/webawesome/dist/chunks/chunk.SUZGY3IK.js:
@awesome.me/webawesome/dist/chunks/chunk.HQ5QSGXH.js:
@awesome.me/webawesome/dist/chunks/chunk.VISTEVIJ.js:
@awesome.me/webawesome/dist/components/mutation-observer/mutation-observer.js:
@awesome.me/webawesome/dist/chunks/chunk.5J72BVE2.js:
@awesome.me/webawesome/dist/chunks/chunk.AYWO7BIR.js:
@awesome.me/webawesome/dist/components/number-input/number-input.js:
@awesome.me/webawesome/dist/chunks/chunk.C3KOHXUM.js:
@awesome.me/webawesome/dist/chunks/chunk.B632VLM3.js:
@awesome.me/webawesome/dist/components/option/option.js:
@awesome.me/webawesome/dist/chunks/chunk.D7J2HJDE.js:
@awesome.me/webawesome/dist/chunks/chunk.MDBXI5XL.js:
@awesome.me/webawesome/dist/chunks/chunk.QOAPQ5KN.js:
@awesome.me/webawesome/dist/components/otp-input/otp-input.js:
@awesome.me/webawesome/dist/chunks/chunk.WKX3BKNK.js:
@awesome.me/webawesome/dist/chunks/chunk.WNS42D5L.js:
@awesome.me/webawesome/dist/chunks/chunk.VIZ2T2SZ.js:
@awesome.me/webawesome/dist/components/page/page.js:
@awesome.me/webawesome/dist/chunks/chunk.ZY7BMFLO.js:
@awesome.me/webawesome/dist/chunks/chunk.XLATYKDG.js:
@awesome.me/webawesome/dist/chunks/chunk.HJCFTRPZ.js:
@awesome.me/webawesome/dist/chunks/chunk.Z7M3UHNZ.js:
@awesome.me/webawesome/dist/components/pagination/pagination.js:
@awesome.me/webawesome/dist/chunks/chunk.WV6QXBER.js:
@awesome.me/webawesome/dist/chunks/chunk.K6IFCX3B.js:
@awesome.me/webawesome/dist/components/popover/popover.js:
@awesome.me/webawesome/dist/components/popup/popup.js:
@awesome.me/webawesome/dist/chunks/chunk.VTVNMJUY.js:
@awesome.me/webawesome/dist/chunks/chunk.JXBEIEPH.js:
@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js:
@awesome.me/webawesome/dist/chunks/chunk.3HIXNYAW.js:
@awesome.me/webawesome/dist/chunks/chunk.LQ7ZYEBP.js:
@awesome.me/webawesome/dist/components/progress-ring/progress-ring.js:
@awesome.me/webawesome/dist/chunks/chunk.IQFC2JOL.js:
@awesome.me/webawesome/dist/chunks/chunk.OXDUIQRC.js:
@awesome.me/webawesome/dist/components/qr-code/qr-code.js:
@awesome.me/webawesome/dist/chunks/chunk.BELHQIBT.js:
@awesome.me/webawesome/dist/chunks/chunk.B5X2I7WQ.js:
@awesome.me/webawesome/dist/components/radio/radio.js:
@awesome.me/webawesome/dist/chunks/chunk.GBDIGVZM.js:
@awesome.me/webawesome/dist/chunks/chunk.5WWEH2IX.js:
@awesome.me/webawesome/dist/components/radio-group/radio-group.js:
@awesome.me/webawesome/dist/chunks/chunk.BZMNT3VX.js:
@awesome.me/webawesome/dist/chunks/chunk.SQ5SWMBF.js:
@awesome.me/webawesome/dist/chunks/chunk.BQMIY5HI.js:
@awesome.me/webawesome/dist/components/random-content/random-content.js:
@awesome.me/webawesome/dist/chunks/chunk.XW6BKGGI.js:
@awesome.me/webawesome/dist/chunks/chunk.TL7XMOW4.js:
@awesome.me/webawesome/dist/chunks/chunk.TOB4Y2F3.js:
@awesome.me/webawesome/dist/components/rating/rating.js:
@awesome.me/webawesome/dist/chunks/chunk.C3P7HR5O.js:
@awesome.me/webawesome/dist/components/relative-time/relative-time.js:
@awesome.me/webawesome/dist/chunks/chunk.DP5YIFD7.js:
@awesome.me/webawesome/dist/chunks/chunk.DVCOR4TS.js:
@awesome.me/webawesome/dist/chunks/chunk.YQ2KR5FP.js:
@awesome.me/webawesome/dist/components/resize-observer/resize-observer.js:
@awesome.me/webawesome/dist/chunks/chunk.KODRBJHJ.js:
@awesome.me/webawesome/dist/chunks/chunk.42HILMGO.js:
@awesome.me/webawesome/dist/components/scroller/scroller.js:
@awesome.me/webawesome/dist/chunks/chunk.ZCRHF4FU.js:
@awesome.me/webawesome/dist/chunks/chunk.HCE4CV72.js:
@awesome.me/webawesome/dist/chunks/chunk.HPULLNVR.js:
@awesome.me/webawesome/dist/chunks/chunk.4AHPL3WP.js:
@awesome.me/webawesome/dist/chunks/chunk.37OOIOGE.js:
@awesome.me/webawesome/dist/components/select/select.js:
@awesome.me/webawesome/dist/chunks/chunk.JLCUD5BZ.js:
@awesome.me/webawesome/dist/chunks/chunk.XQCWQFLH.js:
@awesome.me/webawesome/dist/components/skeleton/skeleton.js:
@awesome.me/webawesome/dist/chunks/chunk.WKHSZB7X.js:
@awesome.me/webawesome/dist/chunks/chunk.MNX2Q2NK.js:
@awesome.me/webawesome/dist/components/slider/slider.js:
@awesome.me/webawesome/dist/components/spinner/spinner.js:
@awesome.me/webawesome/dist/chunks/chunk.ZZ6XGOYX.js:
@awesome.me/webawesome/dist/chunks/chunk.JMBAF4TD.js:
@awesome.me/webawesome/dist/components/split-panel/split-panel.js:
@awesome.me/webawesome/dist/chunks/chunk.C6UR4IOH.js:
@awesome.me/webawesome/dist/chunks/chunk.C3O465I4.js:
@awesome.me/webawesome/dist/components/switch/switch.js:
@awesome.me/webawesome/dist/chunks/chunk.R2GHHEHL.js:
@awesome.me/webawesome/dist/chunks/chunk.4FOSDR4V.js:
@awesome.me/webawesome/dist/components/tab/tab.js:
@awesome.me/webawesome/dist/chunks/chunk.YBFCQDTA.js:
@awesome.me/webawesome/dist/chunks/chunk.SKLR37OM.js:
@awesome.me/webawesome/dist/chunks/chunk.NMA53WZH.js:
@awesome.me/webawesome/dist/chunks/chunk.UUZ6T3PP.js:
@awesome.me/webawesome/dist/chunks/chunk.WRIHAZWX.js:
@awesome.me/webawesome/dist/chunks/chunk.KQ3Z6T2I.js:
@awesome.me/webawesome/dist/components/tab-group/tab-group.js:
@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js:
@awesome.me/webawesome/dist/components/tag/tag.js:
@awesome.me/webawesome/dist/chunks/chunk.WRLWYRIB.js:
@awesome.me/webawesome/dist/chunks/chunk.JVZTFH2D.js:
@awesome.me/webawesome/dist/components/textarea/textarea.js:
@awesome.me/webawesome/dist/chunks/chunk.6VPDWW2I.js:
@awesome.me/webawesome/dist/chunks/chunk.DWFVINUB.js:
@awesome.me/webawesome/dist/chunks/chunk.7CRW2O2U.js:
@awesome.me/webawesome/dist/components/time-input/time-input.js:
@awesome.me/webawesome/dist/chunks/chunk.TH7TXQQM.js:
@awesome.me/webawesome/dist/chunks/chunk.73JSW7VZ.js:
@awesome.me/webawesome/dist/chunks/chunk.6AMLOZPA.js:
@awesome.me/webawesome/dist/chunks/chunk.FOZ3VKRK.js:
@awesome.me/webawesome/dist/components/toast/toast.js:
@awesome.me/webawesome/dist/components/toast-item/toast-item.js:
@awesome.me/webawesome/dist/components/tooltip/tooltip.js:
@awesome.me/webawesome/dist/chunks/chunk.LCFSCRUJ.js:
@awesome.me/webawesome/dist/chunks/chunk.ZSEFTQAO.js:
@awesome.me/webawesome/dist/chunks/chunk.26QE47KB.js:
@awesome.me/webawesome/dist/chunks/chunk.FYKN76UA.js:
@awesome.me/webawesome/dist/chunks/chunk.U36KZLSQ.js:
@awesome.me/webawesome/dist/chunks/chunk.AG44H7MD.js:
@awesome.me/webawesome/dist/chunks/chunk.Q6XMGFWJ.js:
@awesome.me/webawesome/dist/chunks/chunk.VT2OVZ4B.js:
@awesome.me/webawesome/dist/chunks/chunk.SOSREYNQ.js:
@awesome.me/webawesome/dist/chunks/chunk.52PSTI2X.js:
@awesome.me/webawesome/dist/chunks/chunk.D6CX7XVW.js:
@awesome.me/webawesome/dist/components/tree/tree.js:
@awesome.me/webawesome/dist/components/tree-item/tree-item.js:
@awesome.me/webawesome/dist/chunks/chunk.GN6FNBVQ.js:
@awesome.me/webawesome/dist/chunks/chunk.D76SAJTH.js:
@awesome.me/webawesome/dist/components/zoomable-frame/zoomable-frame.js:
@awesome.me/webawesome/dist/chunks/chunk.D5YFE5NT.js:
@awesome.me/webawesome/dist/chunks/chunk.N2TXQSKF.js:
@awesome.me/webawesome/dist/chunks/chunk.X55YNZ3B.js:
@awesome.me/webawesome/dist/chunks/chunk.LRYJ2M5H.js:
@awesome.me/webawesome/dist/chunks/chunk.KBS6YHTA.js:
@awesome.me/webawesome/dist/chunks/chunk.ZFSRFTCP.js:
@awesome.me/webawesome/dist/webawesome.js:
  (*! Copyright 2026 Fonticons, Inc. - https://webawesome.com/license *)

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
lit-html/directive.js:
lit-html/directives/unsafe-html.js:
@lit/context/lib/decorators/provide.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
@lit/context/lib/decorators/consume.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
lit-html/directives/map.js:
lit-html/directives/range.js:
lit-html/directives/when.js:
@lit/context/lib/context-request-event.js:
@lit/context/lib/create-context.js:
@lit/context/lib/controllers/context-consumer.js:
@lit/context/lib/value-notifier.js:
@lit/context/lib/controllers/context-provider.js:
@lit/context/lib/context-root.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/class-map.js:
lit-html/directives/style-map.js:
lit-html/directives/if-defined.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directive-helpers.js:
lit-html/static.js:
lit-html/directives/live.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
