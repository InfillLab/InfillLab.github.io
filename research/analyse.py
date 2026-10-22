import json,gzip,hashlib,csv,statistics,math,sys
from pathlib import Path
import pandas as pd
import numpy as np
root=Path(sys.argv[1] if len(sys.argv)>1 else '.local/research-v21');out=Path(sys.argv[2] if len(sys.argv)>2 else 'C:/Users/mihae/Downloads/InfillLab_Research_Results');out.mkdir(exist_ok=True,parents=True)
m=json.loads((root/'manifest.json').read_text());rows=[];cfg=[];maxerr=0
for name,h in m['hashes'].items():assert hashlib.sha256(Path(f'src/model/{name}.ts').read_bytes()).hexdigest()==h
for item in m['configurations']:
 r=json.loads(gzip.decompress((root/'runs'/f"{item['id']}.json.gz").read_bytes()));c=r['config'];b=r['bounds'];ss=r['segments'];assert len(r['replicates'])==30
 info={**c,'id':r['id'],'groups':'|'.join(r['groups']),'capacity':b['capacity'],'eligible':b['eligible'],'eta_bound':b['upperUse']/c['transitionVolume'],'ratio':round(c['transitionVolume']/b['capacity'],6),'n_segments':len(ss)}
 for j,res in enumerate(r['baselines']+r['replicates']):
  ids=[];cursor=0;sumv=0
  for step in res['steps']:
   s=ss[step['id']];assert step['id'] not in ids;assert s.get('predecessor') is None or s['predecessor'] in ids
   assert step['start']>=cursor-1e-7;assert abs(step['end']-step['start']-s['volume'])<1e-7
   for v in (step['start'],step['end']):
    frac=(v/c['transitionVolume'])**c['gamma'];frac=frac if c['direction']=='AB' else 1-frac
    assert max(c['eligibleLow'],s['low'])-1e-7<=frac<=min(c['eligibleHigh'],s['high'])+1e-7
   cursor=step['end'];sumv+=s['volume'];ids.append(step['id'])
  err=abs(res['used']+res['discarded']-c['transitionVolume']);maxerr=max(maxerr,err);assert err<1e-7 and abs(sumv-res['used'])<1e-7
  assert res['used']<=b['upperUse']+1e-7
  assert abs(res['coverage']-res['used']/b['capacity'])<1e-7
  assert res['complete']==(len(ids)==len(ss))
  rows.append({**info,'method':res['algorithm'],'seed':res.get('seed',''),'used':res['used'],'discarded':res['discarded'],'eta':res['used']/c['transitionVolume'],'coverage':res['coverage'],'travel':res['travel'],'score':res['score'],'complete':res['complete'],'evaluations':res['evaluations'],'runtime_ms':res['runtimeMs'],'violations':0})
 base=max(r['baselines'],key=lambda v:(v['complete'],round(v['coverage'],8),-v['score']));reps=r['replicates'];q=lambda key:float(np.median([v[key] for v in reps]));use=q('used');travel=q('travel');cov=q('coverage');score=q('score')
 cfg.append({**info,'reference_eta':r['baselines'][0]['used']/c['transitionVolume'],'nearest_eta':r['baselines'][1]['used']/c['transitionVolume'],'best_eta':base['used']/c['transitionVolume'],'adaptive_eta':use/c['transitionVolume'],'coverage':cov,'travel':travel,'best_travel':base['travel'],'gain_pp':100*(use-base['used'])/c['transitionVolume'],'complete_rate':sum(v['complete'] for v in reps)/30,'median_ms':q('runtimeMs'),'q25_eta':float(np.quantile([v['used']/c['transitionVolume'] for v in reps],.25)),'q75_eta':float(np.quantile([v['used']/c['transitionVolume'] for v in reps],.75)),'equal_use_travel_gain':base['travel']-travel if abs(use-base['used'])<1e-7 else None,'rank_improve':cov>base['coverage']+1e-8 or(abs(cov-base['coverage'])<=1e-8 and score<base['score']-1e-8)})
df=pd.DataFrame(rows);cf=pd.DataFrame(cfg);df.to_csv(out/'all_runs.csv',index=False);cf.to_csv(out/'configuration_summary.csv',index=False)
main=cf[cf.groups.str.contains('main')]
def qstats(s):
 if len(s)==0:return {k:None for k in ['median','q25','q75','min','max']}
 return {'median':float(s.median()),'q25':float(s.quantile(.25)),'q75':float(s.quantile(.75)),'min':float(s.min()),'max':float(s.max())}
report={'configurations':len(cf),'adaptive_runs':int((df.method=='Adaptive search').sum()),'baseline_runs':int((df.method!='Adaptive search').sum()),'max_balance_error':maxerr,'model_hashes':m['hashes'],'machine':{k:m[k] for k in ['cpu','node','platform','createdAt']},'main':{'count':len(main),'gain':qstats(main.gain_pp),'improved_use':int((main.gain_pp>1e-6).sum()),'improved_rank':int(main.rank_improve.sum()),'tied_use':int((main.gain_pp.abs()<=1e-6).sum()),'adaptive_eta':qstats(main.adaptive_eta),'timing_ms':qstats(df[df.method=='Adaptive search'].runtime_ms)},'ratio':{},'pattern':{},'nonlinear':{},'segmentation':{}}
for ratio,g in main.groupby('ratio'):report['ratio'][str(ratio)]={'count':len(g),'adaptive_eta':qstats(g.adaptive_eta),'best_eta':qstats(g.best_eta),'coverage':qstats(g.coverage),'gain_pp':qstats(g.gain_pp),'complete_rate':float(g.complete_rate.mean())}
for pattern,g in main.groupby('pattern'):report['pattern'][pattern]={'count':len(g),'gain_pp':qstats(g.gain_pp),'improved_use':int((g.gain_pp>1e-6).sum()),'improved_rank':int(g.rank_improve.sum()),'adaptive_eta':qstats(g.adaptive_eta)}
nonlin=cf[(cf.capacityMode=='equal')&(cf.ratio==1)&(cf.acceptance=='graded')&(cf.tolerance.isin([.1,.25]))&(cf.segmentLength==2)]
for gamma,g in nonlin.groupby('gamma'):report['nonlinear'][str(gamma)]={'count':len(g),'eta':qstats(g.adaptive_eta),'bound':float(g.eta_bound.iloc[0])}
for length,g in cf[cf.groups.str.contains('segmentation')].groupby('segmentLength'):report['segmentation'][str(length)]={'count':len(g),'eta':qstats(g.adaptive_eta),'time_ms':qstats(g.median_ms)}
(out/'statistics.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report,indent=2))
