from pathlib import Path
import json,sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
out=Path(sys.argv[1] if len(sys.argv)>1 else 'C:/Users/mihae/Downloads/InfillLab_Research_Results');figdir=out/'figures';figdir.mkdir(exist_ok=True)
if Path('C:/Windows/Fonts/times.ttf').exists():font_manager.fontManager.addfont('C:/Windows/Fonts/times.ttf')
plt.rcParams.update({'font.family':'Times New Roman','font.size':11,'axes.labelsize':11,'xtick.labelsize':10,'ytick.labelsize':10,'legend.fontsize':10,'axes.spines.top':False,'axes.spines.right':False,'axes.linewidth':.7,'lines.linewidth':1.1,'savefig.dpi':600,'pdf.fonttype':42})
a=pd.read_csv(out/'configuration_summary.csv');b=pd.read_csv(out/'segment_05/configuration_summary.csv');m=a[a.groups.str.contains('main')]
names={'concentric':'Concentric','rectilinear':'Rectilinear','monotonic':'Monotonic','monotonic-line':'Monotonic line','global-monotonic':'Global monotonic line','aligned':'Aligned rectilinear','hilbert':'Hilbert curve','archimedean':'Archimedean chords','octagram':'Octagram spiral','taii':'TAII'}
def save(fig,name):
 fig.savefig(figdir/(name+'.png'),dpi=600,facecolor='white');fig.savefig(figdir/(name+'.pdf'));plt.close(fig)
from matplotlib.lines import Line2D
f,axs=plt.subplots(1,2,figsize=(6.65,3.8),sharey=True);f.subplots_adjust(left=.30,right=.98,bottom=.16,top=.81,wspace=.25)
for ax in axs:
 for i,(p,n) in enumerate(names.items()):
  g=m[m.pattern==p];v=g.gain_pp.to_numpy();ys=i+(np.arange(len(g))%9-4)*.047
  ax.plot(v,ys,'o',ms=2.8,mfc='white',mec='.25',mew=.55,alpha=.85)
  ax.plot(np.median(v),i,'D',ms=4.5,color='black')
 ax.axvline(0,color='.7',lw=.6,zorder=0)
axs[0].set_yticks(range(10),names.values());axs[0].invert_yaxis()
axs[0].set_xlim(-1.7,51);axs[0].set_xticks([0,25,50]);axs[0].set_title('(a) Full range',loc='left',fontsize=11,pad=9)
axs[1].set_xlim(-.10,2.08);axs[1].set_xticks([0,1,2]);axs[1].set_title('(b) Detail near zero',loc='left',fontsize=11,pad=9)
f.supxlabel('Utilisation gain (percentage points)',fontsize=11,y=.015)
f.legend(handles=[Line2D([],[],marker='o',ls='',mfc='white',mec='.25',ms=4,label='Configuration'),Line2D([],[],marker='D',ls='',color='black',ms=4.5,label='Median')],loc='upper center',bbox_to_anchor=(.63,1.0),ncol=2,frameon=False,handletextpad=.5,columnspacing=1.4)
save(f,'Figure_1_pattern_gains')
f,axs=plt.subplots(1,2,figsize=(6.65,3.05));f.subplots_adjust(left=.10,right=.985,bottom=.22,top=.88,wspace=.34)
ax=axs[0];ratios=[.5,1,2]
for field,offset,marker,label in [('best_eta',-.04,'s','Better baseline'),('adaptive_eta',.04,'o','Adaptive search')]:
 vals=[m[m.ratio==r][field]*100 for r in ratios];med=np.array([v.median() for v in vals]);err=np.array([[med[i]-v.quantile(.25) for i,v in enumerate(vals)],[v.quantile(.75)-med[i] for i,v in enumerate(vals)]])
 ax.errorbar(np.arange(3)+offset,med,yerr=err,fmt=marker+'-',color='black' if field=='adaptive_eta' else '.55',mfc='white' if field=='best_eta' else 'black',ms=4,capsize=3,label=label)
ax.plot(range(3),[80,80,50],'k--',label='Upper bound',lw=.8)
ax.set_xticks(range(3),['0.5','1','2']);ax.set_xlabel('Transition volume / capacity');ax.set_ylabel('Utilisation (%)');ax.set_title('(a)',loc='left',fontsize=11);ax.set_ylim(0,103);ax.legend(loc='lower left',frameon=False,handlelength=1.6,labelspacing=.25)
ax=axs[1];g=a[(a.capacityMode=='equal')&(a.ratio==1)&(a.acceptance=='graded')&(a.tolerance.isin([.1,.25]))&(a.segmentLength==2)]
vals=[g[g.gamma==r].adaptive_eta*100 for r in ratios];med=np.array([v.median() for v in vals]);err=np.array([[med[i]-v.quantile(.25) for i,v in enumerate(vals)],[v.quantile(.75)-med[i] for i,v in enumerate(vals)]])
ax.errorbar(range(3),med,yerr=err,fmt='ko-',ms=4,capsize=3);ax.plot(range(3),[80,80,100*(np.sqrt(.9)-np.sqrt(.1))],'k--',lw=.8);ax.set_xticks(range(3),['0.5','1','2']);ax.set_xlabel('Composition exponent');ax.set_ylim(0,103);ax.set_title('(b)',loc='left',fontsize=11)
save(f,'Figure_2_capacity_and_composition')
s=pd.concat([a[a.groups.str.contains('segmentation')],b],ignore_index=True);ref=s[s.segmentLength==2][['pattern','direction','adaptive_eta']].rename(columns={'adaptive_eta':'ref_eta'});s=s.merge(ref,on=['pattern','direction']);s['difference_pp']=100*(s.adaptive_eta-s.ref_eta)
f,axs=plt.subplots(1,2,figsize=(6.65,3.0));f.subplots_adjust(left=.11,right=.98,bottom=.23,top=.87,wspace=.35);lens=[.5,1,2,4,6,8]
ax=axs[0];series=[s[s.segmentLength==l].difference_pp.to_numpy() for l in lens];ax.boxplot(series,positions=range(6),widths=.48,showfliers=True,patch_artist=False,medianprops={'color':'black','linewidth':1.2},boxprops={'color':'black','linewidth':.7},whiskerprops={'color':'black','linewidth':.7},capprops={'color':'black','linewidth':.7},flierprops={'marker':'o','markerfacecolor':'white','markeredgecolor':'black','markersize':3});ax.axhline(0,c='.65',lw=.6);ax.set_ylabel('Change from 2 mm (percentage points)');ax.set_xticks(range(6),['0.5','1','2','4','6','8']);ax.set_xlabel('Nominal segment length (mm)');ax.set_title('(a)',loc='left',fontsize=11)
ax=axs[1];med=np.array([s[s.segmentLength==l].median_ms.median() for l in lens]);lo=np.array([s[s.segmentLength==l].median_ms.quantile(.25) for l in lens]);hi=np.array([s[s.segmentLength==l].median_ms.quantile(.75) for l in lens]);ax.errorbar(range(6),med,yerr=[med-lo,hi-med],fmt='ko-',ms=4,capsize=3);ax.set_yscale('log');ax.set_xticks(range(6),['0.5','1','2','4','6','8']);ax.set_xlabel('Nominal segment length (mm)');ax.set_ylabel('Run time (ms)');ax.set_title('(b)',loc='left',fontsize=11)
save(f,'Figure_3_segmentation')
s.to_csv(out/'segmentation_comparison.csv',index=False)
report={'configurations':540,'adaptive_runs':16200,'baseline_runs':1080,'schedule_results':17280,'independent_check_violations':0,'segmentation':{}}
for l,g in s.groupby('segmentLength'):
 report['segmentation'][str(l)]={'count':len(g),'eta_median_pct':100*g.adaptive_eta.median(),'eta_q25_pct':100*g.adaptive_eta.quantile(.25),'eta_q75_pct':100*g.adaptive_eta.quantile(.75),'runtime_median_ms':g.median_ms.median(),'change_min_pp':g.difference_pp.min(),'change_max_pp':g.difference_pp.max()}
t=s[s.segmentLength==.5].merge(s[s.segmentLength==1],on=['pattern','direction'],suffixes=('_05','_1'));diff=100*(t.adaptive_eta_05-t.adaptive_eta_1);report['half_vs_one']={'median_pp':diff.median(),'min_pp':diff.min(),'max_pp':diff.max()}
(out/'combined_statistics.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report,indent=2))
