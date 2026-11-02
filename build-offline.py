from pathlib import Path
import re
P=Path(__file__).resolve().parent
dist=P/'dist'
html=(dist/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+(dist/'styles.css').read_text(encoding='utf-8')+'\n</style>')
def inline(match):
    source=(dist/match[1]).read_text(encoding='utf-8')
    return '<script>\n'+source.replace('</script','<\\/script')+'\n</script>'
html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
html=html.replace('<head>','<head>\n<!-- D3.js license\n'+(dist/'vendor/D3-LICENSE.txt').read_text()+'\n-->')
(P/'H1_狼人杀互动关系图.html').write_text(html,encoding='utf-8')
print('Offline HTML:',len(html.encode('utf-8')),'bytes')
