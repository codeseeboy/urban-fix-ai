/**
 * Map rendered with Leaflet + CARTO dark tiles inside a WebView. No Google Maps
 * key or signing-certificate setup is needed, and the dark basemap matches the
 * app. Markers are pushed in via injectJavaScript so updates don't reload tiles.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/theme/tokens';

// The package's default generic resolves props to `never` under React 19 types.
const Web = RNWebView<Record<never, never>>;
type WebHandle = RNWebView<Record<never, never>>;

export type MapPoint = { id: string; lat: number; lon: number; color: string; pulse?: boolean; selected?: boolean };

export type LeafletMapHandle = { flyTo: (lat: number, lon: number, zoom?: number) => void };

type Props = {
  points: MapPoint[];
  center: { lat: number; lon: number };
  zoom?: number;
  user?: { lat: number; lon: number } | null;
  onSelect?: (id: string) => void;
  onMapPress?: () => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

const html = (center: { lat: number; lon: number }, zoom: number, interactive: boolean) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:${colors.bg}}
.leaflet-container{background:${colors.bg}}
.leaflet-control-attribution{background:rgba(11,16,33,.6)!important;color:#6E7AA0!important;font-size:9px}
.leaflet-control-attribution a{color:#6E7AA0!important}
.pin{border-radius:50%;border:2.5px solid #0B1021;box-shadow:0 0 0 1.5px rgba(255,255,255,.18),0 2px 8px rgba(0,0,0,.5);transition:transform .15s}
.pin.sel{transform:scale(1.45);border-color:#fff}
.pulse{position:absolute;inset:-9px;border-radius:50%;animation:p 1.6s ease-out infinite}
@keyframes p{0%{transform:scale(.4);opacity:.8}100%{transform:scale(1.4);opacity:0}}
.me{width:16px;height:16px;border-radius:50%;background:#2D7CF6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(45,124,246,.25)}
</style></head><body><div id="m"></div><script>
var post=function(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var map=L.map('m',{zoomControl:false,attributionControl:true,dragging:${interactive},touchZoom:${interactive},doubleClickZoom:${interactive},scrollWheelZoom:false,tap:${interactive}}).setView([${center.lat},${center.lon}],${zoom});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd',attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
var layer=L.layerGroup().addTo(map),me=null;
map.on('click',function(){post({type:'map'})});
window.setPoints=function(pts){layer.clearLayers();pts.forEach(function(p){
 var s=p.selected?16:13;
 var h='<div style="position:relative;width:'+s+'px;height:'+s+'px">'+(p.pulse?'<div class="pulse" style="background:'+p.color+'55"></div>':'')+'<div class="pin'+(p.selected?' sel':'')+'" style="width:'+s+'px;height:'+s+'px;background:'+p.color+'"></div></div>';
 var m=L.marker([p.lat,p.lon],{icon:L.divIcon({html:h,className:'',iconSize:[s,s],iconAnchor:[s/2,s/2]}),zIndexOffset:p.selected?1000:0});
 m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:p.id})});layer.addLayer(m);})};
window.setUser=function(u){if(me){map.removeLayer(me);me=null}if(u){me=L.marker([u.lat,u.lon],{icon:L.divIcon({html:'<div class="me"></div>',className:'',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(map)}};
window.flyTo=function(a,b,z){map.flyTo([a,b],z||map.getZoom(),{duration:.6})};
post({type:'ready'});
</script></body></html>`;

export const LeafletMap = forwardRef<LeafletMapHandle, Props>(function LeafletMap(
  { points, center, zoom = 14, user, onSelect, onMapPress, interactive = true, style },
  ref,
) {
  const web = useRef<WebHandle>(null);
  const [ready, setReady] = useState(false);
  // The page is built once; later centre changes go through flyTo.
  const source = useMemo(() => ({ html: html(center, zoom, interactive) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, z) => web.current?.injectJavaScript(`window.flyTo(${lat},${lon},${z ?? 'undefined'});true;`),
  }));

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.setPoints(${JSON.stringify(points)});true;`);
  }, [ready, points]);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.setUser(${JSON.stringify(user ?? null)});true;`);
  }, [ready, user]);

  return (
    <View style={[styles.wrap, style]}>
      <Web
        ref={web}
        source={source}
        originWhitelist={['*']}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        setBuiltInZoomControls={false}
        onMessage={(e: WebViewMessageEvent) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'ready') setReady(true);
            else if (msg.type === 'select') onSelect?.(msg.id);
            else if (msg.type === 'map') onMapPress?.();
          } catch {}
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
});
