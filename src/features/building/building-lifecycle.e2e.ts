import { test, expect } from "../mailbox/acceptance-fixtures";

test("STD-01 unmount releases owned resources and reuses shared geometry", async ({
  page,
  app,
}, testInfo) => {
  await page.goto(app.url);
  const transformed = await (
    await page.request.get(`${app.url}/src/features/island/IslandScene.tsx`)
  ).text();
  const imports = [...transformed.matchAll(/from "([^"]+)"/g)].map(
    (match) => match[1],
  );
  const moduleUrl = (name: string) => {
    const url = imports.find((path) => path?.includes(`/${name}.js`));
    if (!url) throw new Error(`Missing transformed module ${name}`);
    return url;
  };
  await page.addScriptTag({
    type: "module",
    content: `
import React from ${JSON.stringify(moduleUrl("react"))};
import {createRoot,extend} from ${JSON.stringify(moduleUrl("@react-three_fiber"))};
import * as THREE from ${JSON.stringify(moduleUrl("three"))};
import {Building} from '/src/features/building/Building.tsx';
extend(THREE);
const canvas=document.createElement('canvas');document.body.append(canvas);
const root=createRoot(canvas);
await root.configure({size:{width:300,height:300,top:0,left:0},camera:{position:[0,3,5]},frameloop:'always'});
const tree=()=>React.createElement(React.Fragment,null,
  React.createElement(Building,{domainId:'core-projects',unreadCount:30}),
  React.createElement(Building,{domainId:'finance-bills',unreadCount:30}));
const store=root.render(tree());
const owned=new Set(), shared=new Set(), disposed=new Set();
window.buildingLifecycle={
 capture(){
  store.getState().scene.traverse(object=>{
   if(!object.isMesh)return;
   for(const resource of [object.geometry,object.material]){
    const collection=resource.type==='ExtrudeGeometry'?shared:owned;
    if(collection.has(resource.uuid))continue;
    collection.add(resource.uuid);resource.addEventListener('dispose',()=>disposed.add(resource.uuid));
   }
  });
  return {owned:owned.size,shared:shared.size};
 },
 clear(){root.render(null);},
 status(){return {owned:owned.size,disposedOwned:[...owned].filter(id=>disposed.has(id)).length,disposedShared:[...shared].filter(id=>disposed.has(id)).length};},
 remount(){root.render(tree());},
 reused(){const ids=new Set();store.getState().scene.traverse(object=>{if(object.isMesh&&object.geometry.type==='ExtrudeGeometry')ids.add(object.geometry.uuid);});return {count:ids.size,allOriginal:[...ids].every(id=>shared.has(id))};},
 stop(){root.unmount();}
};`,
  });
  await page.waitForFunction("Boolean(window.buildingLifecycle)");
  await expect
    .poll(() => page.evaluate("window.buildingLifecycle.capture().shared"))
    .toBe(2);
  const count = await page.evaluate<number>(
    "window.buildingLifecycle.capture().owned",
  );
  expect(count).toBeGreaterThan(20);
  await page.evaluate("window.buildingLifecycle.clear()");
  await expect
    .poll(() => page.evaluate("window.buildingLifecycle.status()"))
    .toEqual({ owned: count, disposedOwned: count, disposedShared: 0 });
  await page.evaluate("window.buildingLifecycle.remount()");
  await expect
    .poll(() => page.evaluate("window.buildingLifecycle.reused()"))
    .toEqual({ count: 2, allOriginal: true });
  await testInfo.attach("resource-disposal.json", {
    body: JSON.stringify({
      ownedResources: count,
      afterUnmount: await page.evaluate("window.buildingLifecycle.status()"),
      afterRemount: await page.evaluate("window.buildingLifecycle.reused()"),
    }),
    contentType: "application/json",
  });
  await page.evaluate("window.buildingLifecycle.stop()");
});
