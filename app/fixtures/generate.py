from pathlib import Path
from PIL import Image, ImageDraw
import json
root=Path(__file__).parent
im=Image.new('RGB',(1200,630),'#315e63');d=ImageDraw.Draw(im);d.ellipse((800,70,960,230),fill='#f2cf90');d.polygon([(800,220),(920,260),(690,630),(470,630)],fill='#da875d');im.save(root/'FX-IMG-001.png')
for c in ['red','blue']:
 im=Image.new('RGB',(600,400),c);d=ImageDraw.Draw(im);d.ellipse((370,50,470,150),fill='white');im.save(root/f'FX-IMG-002-{c}.png')
im=Image.new('RGBA',(400,400));d=ImageDraw.Draw(im);d.ellipse((40,40,360,360),fill=(242,190,110,140),outline='white',width=5);im.save(root/'FX-IMG-003.png')
for number,size in [('004',(600,400)),('005',(4000,3000)),('006',(64,64)),('010',(800,600))]:
 im=Image.new('RGB',size,'white');d=ImageDraw.Draw(im)
 for x in range(0,size[0],20):d.line((x,0,x,size[1]),fill='#224b39',width=2)
 for y in range(0,size[1],20):d.line((0,y,size[0],y),fill='#d8a15d',width=2)
 im.save(root/f'FX-IMG-{number}.png')
im=Image.open(root/'FX-IMG-001.png');exif=Image.Exif();exif[274]=6;im.save(root/'FX-IMG-007.jpg',exif=exif)
im=Image.new('RGBA',(300,120));d=ImageDraw.Draw(im);d.line([(20,80),(80,20),(140,100),(220,20),(280,80)],fill='#182a25',width=10);im.save(root/'FX-IMG-008.png')
im=Image.new('RGB',(600,300));d=ImageDraw.Draw(im)
for i,c in enumerate(['#183c34','#f2cf90','#d4845d','#ffffff','#9ab496','#524c71']):d.rectangle((i*100,0,(i+1)*100,300),fill=c)
im.save(root/'FX-IMG-009.png')
(root/'composition.json').write_text(json.dumps({'fixture':'FX-IMG-001','keep':[[.66,.1],[.8,.1],[.8,.37],[.66,.37]],'avoid':[[.38,.75],[.6,.75],[.6,1],[.38,1]],'rotation':-20,'maxDelta':15},indent=2))
