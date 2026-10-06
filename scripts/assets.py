"""Create web derivatives only from the owner's selected production assets."""
from pathlib import Path
import json, re, shutil, os
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'ref'/'production'
DEST=Path(os.environ.get('SITE_OUTPUT_DIR',str(ROOT/'dist'))).resolve()/'assets'
CAPTIONS={
3:('Exterior','Social Street home — property title image'),5:('Exterior','Aerial view of the home and front garden'),8:('Exterior','Front entrance, garden and double garage'),12:('Entry','Entrance hallway leading towards the living area'),
15:('OOA bedroom','Overnight onsite assistance bedroom'),17:('OOA bedroom','OOA bedroom with window and split-system unit'),19:('OOA bedroom','OOA bedroom and adjoining shower room'),20:('OOA bedroom','View from the OOA room towards its ensuite'),21:('OOA bedroom','OOA room doorway and adjoining ensuite'),22:('OOA bedroom','OOA ensuite entrance'),23:('OOA ensuite','OOA ensuite vanity and shower'),26:('OOA ensuite','Shower fitting in the OOA ensuite'),27:('OOA ensuite','Toilet in the OOA ensuite'),
29:('Bedroom 1','Participant bedroom one, shown furnished'),33:('Bedroom 1','Detail of the bed styling in bedroom one'),34:('Bedroom 1','Bedside furnishings in bedroom one'),36:('Bedroom 1','Bedroom one window and wardrobe'),39:('Ensuite 1','Participant ensuite one with shower and support rails'),49:('Ensuite 1','Bathroom rail and fittings detail'),
50:('Living & kitchen','Open-plan dining and living area looking towards the alfresco'),51:('Living & kitchen','Dining space connected to the living area'),52:('Living & kitchen','Living room and kitchen in the shared open-plan space'),56:('Living & kitchen','Kitchen cabinetry and benchtop'),58:('Living & kitchen','Kitchen work area beneath the window'),59:('Living & kitchen','Kitchen benchtop and appliance styling'),61:('Living & kitchen','Kitchen sink and cabinetry'),63:('Living & kitchen','Kitchen benchtop with clear space underneath'),72:('Living & kitchen','Shared living area looking back towards the kitchen'),75:('Living & kitchen','Dining table beside the shared living space'),77:('Living & kitchen','Dining area with kitchen beyond'),78:('Living & kitchen','Dining table styling detail'),
80:('Bedroom 2','Participant bedroom two, shown unfurnished'),83:('Bedroom 2','Bedroom two doorway and room layout'),85:('Bedroom 2','Bedroom two wardrobe and entrance'),86:('Bedroom 2','Open wardrobe in bedroom two'),87:('Bedroom 2','Bedroom two adjoining ensuite entrance'),91:('Ensuite 2','Shower area in participant ensuite two'),96:('Ensuite 2','Toilet and support rails in participant ensuite two'),
97:('Outdoor space','Covered alfresco and rear lawn'),100:('Outdoor space','Rear lawn beside the alfresco deck'),101:('Outdoor space','Sheltered alfresco looking towards the garden'),102:('Outdoor space','Alfresco deck and outside seating'),103:('Outdoor space','Rear garden and the outside of the home'),104:('Outdoor space','Rear elevation and lawn'),105:('Outdoor space','Covered outdoor area and side pathway'),106:('Outdoor space','Garden alongside the alfresco'),107:('Outdoor space','Alfresco seating, lawn and side access'),
108:('Garage & utilities','Inside the double garage'),110:('Garage & utilities','Equipment pictured in the garage — specifications to be confirmed'),113:('Garage & utilities','Laundry cabinetry and appliances'),115:('Garage & utilities','Laundry shelf detail'),116:('Garage & utilities','Laundry appliance space'),119:('Garage & utilities','Wall-mounted air conditioning unit'),121:('Garage & utilities','Security alarm control panel'),123:('Nearby','Aerial view of the local playground'),126:('Nearby','Aerial view of Tarneit Central shopping centre')}
GROUPS=['Exterior','Entry','Living & kitchen','Bedroom 1','Ensuite 1','Bedroom 2','Ensuite 2','OOA bedroom','OOA ensuite','Outdoor space','Garage & utilities','Nearby']

def versions(source,slug,plan=False):
    im=ImageOps.exif_transpose(Image.open(source)).convert('RGB')
    for width in ([400,1000,2000] if plan else [240,800,1600]):
        target=DEST/f'{slug}-{width}.webp'
        if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
            copy=im.copy();copy.thumbnail((width,width*4));copy.save(target,'WEBP',quality=86 if plan else 80,method=6)
    return {'width':im.width,'height':im.height}

def build_assets():
    DEST.mkdir(parents=True,exist_ok=True)
    photos=[]
    for source in (SOURCE/'stills-1s - keep').iterdir():
        if source.suffix.lower() not in ['.jpg','.jpeg','.png']:continue
        number=int(re.search(r'still-(\d+)',source.name)[1]);group,caption=CAPTIONS[number]
        slug=f'photo-{number:03}'
        photos.append(dict(id=number,slug=slug,group=group,caption=caption,**versions(source,slug)))
    photos.sort(key=lambda p:(GROUPS.index(p['group']),p['id']))
    # Remove only our generated derivatives for stills no longer selected by the owner.
    selected={p['slug'] for p in photos}
    for derivative in DEST.glob('photo-*-*.webp'):
        if re.fullmatch(r'photo-\d{3}-(240|800|1600)\.webp',derivative.name) and '-'.join(derivative.stem.split('-')[:2]) not in selected:
            derivative.unlink()
    # File names are reversed. Identification comes from visually inspecting the images.
    versions(SOURCE/'nearby'/'Tarneit shopping.jpg','nearby-playground')
    versions(SOURCE/'nearby'/'Playground 50m.jpg','nearby-shopping')
    versions(SOURCE/'2d floor-plan'/'tarneit-friendly-floor-plan.png','plan-2d',True)
    versions(SOURCE/'3d floorplan'/'tarneit 3D floorplan-car-rotated.png','plan-3d',True)
    for ext in ['pdf','svg']:
        shutil.copy2(SOURCE/'2d floor-plan'/f'tarneit-friendly-floor-plan.{ext}',DEST/f'tarneit-floor-plan.{ext}')
    video=SOURCE/'video'/'tarneit-720p.mp4'
    if video.stat().st_size>50_000_000:raise ValueError('Expected the compressed walkthrough, not a video master.')
    if not (DEST/'tarneit-720p.mp4').exists() or video.stat().st_mtime>(DEST/'tarneit-720p.mp4').stat().st_mtime:shutil.copy2(video,DEST/'tarneit-720p.mp4')
    (DEST/'gallery.json').write_text(json.dumps(photos),encoding='utf-8')
    return photos

if __name__=='__main__':print(f'Prepared {len(build_assets())} selected stills.')
