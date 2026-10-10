import test from 'node:test';
import assert from 'node:assert/strict';
import {contrastInk,publicAppearance,readableAccentOnWhite} from '../src/modules/widget/appearance.js';
import {contrastRatio,parseCssColor} from './helpers/accessibility-contrast.mjs';

test('readable configured accents retain their exact values, including the saved dark brand',()=>{
 for(const color of ['#204b3a','#000000','#5148d8','#767676','#Aa0033']){
  assert.ok(contrastRatio(color,'#ffffff',null)>=4.5);
  assert.equal(readableAccentOnWhite(color),color);
 }
});

test('white and light accents produce readable brand-derived tones rather than a fixed ink',()=>{
 const colors=['#ffffff','#fff3a3','#e8b8ff','#a3f3ff'];
 const effective=colors.map(color=>readableAccentOnWhite(publicAppearance({primary_color:color}).color));
 assert.equal(new Set(effective).size,colors.length,'distinct brand hues retain distinct effective inks');
 for(const [index,color] of colors.entries()){
  const ink=effective[index],original=parseCssColor(color),toned=parseCssColor(ink);
  assert.notEqual(ink,color);
  assert.ok(contrastRatio(ink,'#ffffff',null)>=4.5,`${color} -> ${ink}`);
  // Scaling all RGB channels toward black preserves their proportions within 8-bit quantization.
  const scale=Math.max(...toned.slice(0,3))/Math.max(...original.slice(0,3));
  for(let channel=0;channel<3;channel++)assert.ok(Math.abs(toned[channel]-original[channel]*scale)<1.1,`${color} channel ${channel} preserves hue`);
 }
});

test('an accent just below AA is darkened using the unrounded contrast ratio',()=>{
 assert.ok(contrastRatio('#777777','#ffffff',null)<4.5);
 const effective=readableAccentOnWhite('#777777');
 assert.notEqual(effective,'#777777');
 assert.ok(contrastRatio(effective,'#ffffff',null)>=4.5);
});

test('the normalized RGB gamut sample meets AA for white-surface links and navigation ink',()=>{
 for(let red=0;red<=255;red+=51)for(let green=0;green<=255;green+=51)for(let blue=0;blue<=255;blue+=51){
  const color='#'+[red,green,blue].map(channel=>channel.toString(16).padStart(2,'0')).join('');
  const effective=readableAccentOnWhite(color);
  assert.ok(contrastRatio(effective,'#ffffff',null)>=4.5,`${color} link ink ${effective}`);
  if(contrastRatio(color,'#ffffff',null)>=4.5)assert.equal(effective,color);
  assert.ok(contrastRatio(contrastInk(color),color,null)>=4.5,`${color} navigation ink`);
 }
});
