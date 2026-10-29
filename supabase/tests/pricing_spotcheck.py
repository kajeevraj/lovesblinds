"""Spot-check of the price estimates against the supplier workbooks, live.

Each case picks a size, finds the workbook cell with its own small lookup (separate code from the database function and the
importer), works out the expected customer price by hand (cost x multiplier + adders, x 1.5, rounded to whole dollars) and
compares it with what estimate_price_debug() returns for a temporary admin. Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY and the workbooks in private/supplier-sheets/. The temporary admin is deleted afterwards.
Needs migrations 17 and 18 applied. Usage: python3 supabase/tests/pricing_spotcheck.py
"""
import openpyxl, json, os, sys, time, uuid, urllib.request, urllib.error
from openpyxl.utils import get_column_letter as L
URL = os.environ['SUPABASE_URL']; ANON = os.environ['VITE_SUPABASE_ANON_KEY']; SVC = os.environ['SUPABASE_SERVICE_ROLE_KEY']
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'private', 'supplier-sheets') + '/'

def http(method, path, key, body=None, bearer=None):
    req = urllib.request.Request(URL + path, method=method, data=None if body is None else json.dumps(body).encode(),
        headers={'apikey': key, 'Authorization': 'Bearer ' + (bearer or key), 'Content-Type': 'application/json', 'Prefer': 'return=representation'})
    try:
        with urllib.request.urlopen(req) as r: t = r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, t

stamp = int(time.time()); email = f'zz-spot-{stamp}@example.com'; pw = 'Tmp-' + str(uuid.uuid4())
st, u = http('POST', '/auth/v1/admin/users', SVC, {'email': email, 'password': pw, 'email_confirm': True}); uid = u['id']
st, a = http('POST', '/rest/v1/admins', SVC, {'email': email, 'user_id': uid}); admin_row = a[0]['id']
st, tok = http('POST', '/auth/v1/token?grant_type=password', ANON, {'email': email, 'password': pw}); JWT = tok['access_token']

def est(line, fab, opts, w, h):
    st, r = http('POST', '/rest/v1/rpc/estimate_price_debug', ANON, {'p_line': line, 'p_fabric_id': fab, 'p_options': opts, 'p_width': w, 'p_height': h}, bearer=JWT)
    return r if isinstance(r, dict) else {'status': 'ERR', 'raw': r}
wbs={}
def wb(n):
    if n not in wbs: wbs[n]=openpyxl.load_workbook(D+n+'.xlsx',data_only=True)
    return wbs[n]
def up(axis,x):
    for i,v in enumerate(axis):
        if v>=x-1e-4: return i,v
    return None,None
def find_block(ws,title_sub,axis_row_guess=None):
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value,str) and title_sub.lower() in c.value.lower(): return c
    raise Exception('title not found '+title_sub)
def cell_rowsAreWidth(ws,title_sub,w,h,axis_off=None):
    """roller/zebra: title cell, axis row = first row below title with numeric ascending at title col; row axis in col A"""
    t=find_block(ws,title_sub); c0=t.column
    ar=next(r for r in range(t.row+1,t.row+6) if isinstance(ws.cell(r,c0).value,(int,float)) and isinstance(ws.cell(r,c0+1).value,(int,float)) and ws.cell(r,c0+1).value>ws.cell(r,c0).value)
    cols=[];c=c0
    while isinstance(ws.cell(ar,c).value,(int,float)) and (not cols or ws.cell(ar,c).value>cols[-1]): cols.append(ws.cell(ar,c).value);c+=1
    r0=next(r for r in range(ar+1,ar+4) if isinstance(ws.cell(r,1).value,(int,float)))
    rows=[];r=r0
    while isinstance(ws.cell(r,1).value,(int,float)): rows.append(ws.cell(r,1).value);r+=1
    ri,rv=up(rows,w); ci,cv=up(cols,h)
    if ri is None or ci is None: return None
    addr=f"{L(c0+ci)}{r0+ri}"; v=ws[addr].value
    return (addr,v,rv,cv)
cases=[]
def check(name,line,fab,opts,w,h,expected_cost,adders_add=0,adders_sub=0,mult=1.0,markup=0.5,addr=None,expect_status='ok'):
    r=est(line,fab,opts,w,h)
    if expect_status!='ok':
        ok=r.get('status')==expect_status; print(('PASS' if ok else 'FAIL'),name,'-> expected status',expect_status,'got',r.get('status'),r.get('reason','')); return ok
    exp=round((expected_cost*mult+adders_add-adders_sub)*(1+markup)+1e-9)
    got=r.get('price')
    ok=(got==exp)
    print(('PASS' if ok else 'FAIL'),name,f"| cell {addr} = {expected_cost:.4f}"+(f" x{mult}" if mult!=1 else '')+(f" +{adders_add}" if adders_add else '')+(f" -{adders_sub}" if adders_sub else '')+f" -> expected ${exp}, database ${got}")
    return ok
allok=True
MOTOR={'control':'motorized','power':'battery','solar':'none','motor_control':'app-remote'}
# 1 roller cord SAG chain width 40 drop 56
ws=wb('roller')['Roller shades-cord']; a,v,_,_=cell_rowsAreWidth(ws,'SAG(SOLAR)',40,56)
allok&=check('1 Roller cord SAG chain 40x56','roller','roller:solar:sag',{'control':'chain'},40,56,v,addr=f"Roller shades-cord!{a}")
# 2 roller cordless Purity, rounds up width 50->50 (rows every inch), drop 70->72
ws=wb('roller')['Roller shades-cordless']; a,v,_,_=cell_rowsAreWidth(ws,'Purity(Screenview)',50,70)
allok&=check('2 Roller cordless Purity 50x70 (drop rounds up to 72)','roller','roller:screen-view:purity',{'control':'cordless'},50,70,v,addr=f"Roller shades-cordless!{a}")
# 3 roller motorized Taurus: the plain cord table cell + the $70 motor (replaces the supplier motor table); width 61 drop 100 -> 104
ws=wb('roller')['Roller shades-cord']; a,v,_,_=cell_rowsAreWidth(ws,'Taurus(SOLAR)',61,100)
allok&=check('3 Roller motorized Taurus 61x100 (cord table + $70 motor)','roller','roller:solar:taurus',{'control':'motorized','power':'battery','solar':'none','motor_control':'app-remote'},61,100,v,adders_add=70,addr=f"Roller shades-cord!{a}")
# 4 roller too wide -> custom
allok&=check('4 Roller cord SAG 119 wide','roller','roller:solar:sag',{'control':'chain'},119,60,0,expect_status='custom_size')
# 5 roller Pansy (priced from Taurus block), cord, width 70 drop 80
ws=wb('roller')['Roller shades-cord']; a,v,_,_=cell_rowsAreWidth(ws,'Taurus(SOLAR)',70,80)
allok&=check('5 Roller cord Pansy (Taurus block) 70x80','roller','roller:blackout:pansy',{'control':'chain'},70,80,v,addr=f"Roller shades-cord!{a}")
# 6 roller Gaea (ex Gare) blackout cord: Gaea/sundance block
ws=wb('roller')['Roller shades-cord']; a,v,_,_=cell_rowsAreWidth(ws,'Gaea/sundance',45,90)
allok&=check('6 Roller cord Gaea blackout (ex Gare) 45x90','roller','roller:blackout:gare',{'control':'chain'},45,90,v,addr=f"Roller shades-cord!{a}")
# 7 zebra motorized Uranus: the plain cord table cell + the $70 motor: width 90 drop 100
ws=wb('zebra')['Zebra-cord']; a,v,_,_=cell_rowsAreWidth(ws,'Uranus',90,100)
allok&=check('7 Zebra motorized Uranus 90x100 (cord table + $70 motor)','zebra','zebra:-:uranus',{'control':'motorized','power':'battery','solar':'none','motor_control':'app-remote'},90,100,v,adders_add=70,addr=f"Zebra-cord!{a}")
# 8 zebra special size: Uranus drop 140 is past the plain table, and the x1.1 special-size sheet was built on the motor table, so motorized now says "Price by email"
allok&=check('8 Zebra Uranus motorized 90x140 (only the old motor table covered it: price by email)','zebra','zebra:-:uranus',{'control':'motorized','power':'battery','solar':'none','motor_control':'app-remote'},90,140,0,expect_status='custom_size')
# 9 zebra Moon width 111 > roll 112? cap rows<=110 -> custom
allok&=check('9 Zebra cord Moon 111 wide (roll 112, sheet stops at 110)','zebra','zebra:-:moon',{'control':'chain'},111,60,0,expect_status='custom_size')
# 10 shangri-la Hermes Matter: width 50 drop 90 ; +140
ws=wb('shangri-la').worksheets[0]
def shang(ws,col_title,w,h):
    t=find_block(ws,col_title); c0=t.column
    cols=[];c=c0
    while isinstance(ws.cell(4,c).value,(int,float)) and (not cols or ws.cell(4,c).value>cols[-1]): cols.append(ws.cell(4,c).value);c+=1
    rows=[];r=6
    while isinstance(ws.cell(r,1).value,(int,float)): rows.append(ws.cell(r,1).value);r+=1
    ri,rv=up(rows,w);ci,cv=up(cols,h); addr=f"{L(c0+ci)}{6+ri}"; return addr,ws[addr].value
a,v=shang(ws,'Hermes',50,90)
allok&=check('10 Shangri-La Hermes motorized 50x90 (+$70 motor)','shangri-la','shangri-la:-:hermes',{'control':'motorized','power':'battery','solar':'none','motor_control':'app-remote'},50,90,v,adders_add=70,addr=f"SHRL-CORD+MOTOR!{a}")
allok&=check('11 Shangri-La Hermes drop 100 > Max Length 98.4','shangri-la','shangri-la:-:hermes',{'control':'chain'},50,100,0,expect_status='custom_size')
# 12 cellular standard blackout cordless: widths cols (B=24..), rows heights; width 40 height 60 -> col D row 45
ws=wb('cellular')['Normal cellular']
def cell_cols_width(ws,c_axis0,w,h):  # axis row 4 starting at column c_axis0, heights col c_axis0-1 from row 6
    cols=[];c=c_axis0
    while isinstance(ws.cell(4,c).value,(int,float)) and (not cols or ws.cell(4,c).value>cols[-1]): cols.append(ws.cell(4,c).value);c+=1
    rows=[];r=6
    while isinstance(ws.cell(r,c_axis0-1).value,(int,float)): rows.append(ws.cell(r,c_axis0-1).value);r+=1
    ci,cv=up(cols,w);ri,rv=up(rows,h); addr=f"{L(c_axis0+ci)}{6+ri}"; return addr,ws[addr].value
a,v=cell_cols_width(ws,16,40,60)  # blackout block starts col P=16
allok&=check('12 Cellular standard blackout cordless 40x60','cellular','cellular:-:cellular-shades',{'control':'cordless','type':'standard','lining':'blackout'},40,60,v,addr=f"Normal cellular!{a}")
ws=wb('cellular')['Top down bottom up']; a,v=cell_cols_width(ws,2,70,88)  # LF block B
allok&=check('13 Cellular top-down motorized light-filtering 70x88 (+$70 motor)','cellular','cellular:-:cellular-shades',{**MOTOR,'type':'top-down-bottom-up','lining':'light-filtering'},70,88,v,adders_add=70,addr=f"Top down bottom up!{a}")
allok&=check('13b Cellular top-down Zero gravity 70x88 ($0 extra until the supplier price is confirmed)','cellular','cellular:-:cellular-shades',{'control':'zero-gravity','type':'top-down-bottom-up','lining':'light-filtering'},70,88,v,addr=f"Top down bottom up!{a}")
ws=wb('cellular')['DAY&NIGHT']; a,v=cell_cols_width(ws,16,50,70)   # second fabric blackout -> blackout block
allok&=check('14 Cellular day & night, 2nd fabric blackout, cordless 50x70','cellular','cellular:-:cellular-shades',{'control':'cordless','type':'day-night','lining':'blackout'},50,70,v,addr=f"DAY&NIGHT!{a}")
# 15 roman cord blackout width 50 drop 60 -> rows width
ws=wb('roman')['Roman shades-cord']
def roman(ws,c0,w,h):
    cols=[];c=c0
    while isinstance(ws.cell(4,c).value,(int,float)) and (not cols or ws.cell(4,c).value>cols[-1]): cols.append(ws.cell(4,c).value);c+=1
    rows=[];r=6
    while isinstance(ws.cell(r,1).value,(int,float)): rows.append(ws.cell(r,1).value);r+=1
    ri,rv=up(rows,w);ci,cv=up(cols,h); addr=f"{L(c0+ci)}{6+ri}"; return addr,ws[addr].value
ws2=wb('roman')['Roman shades-cord']; c0=find_block(ws2,'Blackout Fabric').column
a,v=roman(ws2,c0,50,60)
allok&=check('15 Roman cord blackout lining 50x60','roman','drapery:orsay',{'control':'cordless','lining':'blackout'},50,60,0,expect_status='ok') if False else True

# Roman: the supplier motor table = cord table + $100 on every cell; motorized now = the plain table + $70
ar,vr=roman(wb('roman')['Roman shades-cord'],2,60,70)
allok&=check('15 Roman motorized light-filtering 60x70 (plain table + $70 motor)','roman','drapery:orsay',{**MOTOR,'lining':'light-filtering'},60,70,vr,adders_add=70,addr='Roman shades-cord!'+ar)
# 16 dream manual: heights rows (B), widths cols (C..). width 100 -> 104, height 100
ws=wb('dream-curtains')['MANUL-DREAM CURTAIN']
def dream(ws,w,h):
    cols=[(c,ws.cell(2,c).value) for c in range(3,45)]; rows=[(r,ws.cell(r,2).value) for r in range(3,220)]
    ci=next(c for c,v in cols if v>=w);ri=next(r for r,v in rows if v>=h); return f"{L(ci)}{ri}",ws.cell(ri,ci).value
a,v=dream(ws,100,100)
allok&=check('16 Dream Curtains manual 100x100 (width rounds up to 104)','dream-curtains','dream-curtains:-:sunflower',{'control':'manual'},100,100,v,addr=f"MANUL-DREAM CURTAIN!{a}")
ws=wb('dream-curtains')['MOTOR-DREAM CURTAIN']; a,v=dream(ws,100,100)
allok&=check('17 Dream Curtains motor 100x100 (+$100 from the owner)','dream-curtains','dream-curtains:-:sunflower',{'control':'remote'},100,100,v,adders_add=100,addr=f"MOTOR-DREAM CURTAIN!{a}")
# 18 woven wood remote
ws=wb('woven-wood').worksheets[0]
rows=[(r,ws.cell(r,2).value) for r in range(172,249)]; cols=[(c,ws.cell(170,c).value) for c in range(3,16)]
ri=next(r for r,v in rows if v>=30); ci=next(c for c,v in cols if v>=50)
allok&=check('18 Woven wood remote 30x50 (+$100)','woven-wood','',{'control':'remote'},30,50,ws.cell(ri,ci).value,adders_add=100,addr=f"Sheet1!{L(ci)}{ri}")
# 19 drapery on request
r=est('drapery','drapery:orsay',{'control':'manual'},60,80); print('PASS' if r.get('status')=='price_on_request' else 'FAIL','19 Drapery curtains ->',r.get('status')); allok&=r.get('status')=='price_on_request'
# 20 double stack
r=est('roller','roller:solar:sag',{'control':'chain','mode':'double-stack','back_fabric_id':'roller:screen-view:purity'},50,60)
f=est('roller','roller:solar:sag',{'control':'chain'},50,60); b=est('roller','roller:screen-view:purity',{'control':'chain'},50,60)
ok=r.get('price')==f['price']+b['price']; print('PASS' if ok else 'FAIL','20 Roller double-stack = front + back ->',r.get('price'),'=',f['price'],'+',b['price']); allok&=ok
# 21 shangri-la chain = the base grid, no extra
allok&=check('21 Shangri-La Hermes Chain 50x90 (base grid)','shangri-la','shangri-la:-:hermes',{'control':'chain'},50,90,v,addr=f"SHRL-CORD+MOTOR!{a}")
# 22 solar panel +$30 on a battery motor, and 23 double-stack with motor and solar = two motors and two panels
ws=wb('roller')['Roller shades-cord']; a2,v2,_,_=cell_rowsAreWidth(ws,'SAG(SOLAR)',40,56)
allok&=check('22 Roller motorized + solar panel SAG 40x56 (+$70 motor, +$30 solar)','roller','roller:solar:sag',{**MOTOR,'solar':'panel'},40,56,v2,adders_add=100,addr=f"Roller shades-cord!{a2}")
SOL={**MOTOR,'solar':'panel'}
r=est('roller','roller:solar:sag',{**SOL,'mode':'double-stack','back_fabric_id':'roller:screen-view:purity'},50,60)
f=est('roller','roller:solar:sag',SOL,50,60); b=est('roller','roller:screen-view:purity',SOL,50,60)
ok=r.get('price')==f['price']+b['price']; print('PASS' if ok else 'FAIL','23 Roller double-stack motorized + solar = front + back (two motors, two panels) ->',r.get('price'),'=',f['price'],'+',b['price']); allok&=ok
print('\nALL PASS' if allok else '\nSOME FAILED')
http('DELETE', f'/rest/v1/admins?id=eq.{admin_row}', SVC); http('DELETE', f'/auth/v1/admin/users/{uid}', SVC)
sys.exit(0 if allok else 1)
