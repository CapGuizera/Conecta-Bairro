"""Gera a documentação linha por linha em docs/codigo/ a partir das anotações ann_*.py.

Uso (na raiz do projeto):  python docs/gerador/gerar.py

Cada anotação é (âncora, explicação). O arquivo é dividido em blocos: cada bloco vai da linha
da âncora até a linha anterior à próxima âncora (o primeiro bloco começa na linha 1), e o
trecho de código mostrado é lido do arquivo real. Tipos de âncora:
  "texto"        a linha contém o texto
  "  texto"      a linha começa exatamente com esses espaços e o texto (indentação exata)
  "=texto"       a linha, sem espaços nas pontas, é exatamente o texto
  "a\nb"         duas ou mais linhas seguidas, cada uma com a regra acima

Se o código mudar e uma âncora deixar de existir, o script para com erro dizendo qual,
avisando que a explicação daquele trecho precisa ser revista."""
import importlib, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'codigo')
LANG = {'.js': 'js', '.jsx': 'jsx', '.sql': 'sql', '.bat': 'bat', '.sh': 'bash', '.css': 'css', '.json': 'json', '.yml': 'yaml', '': 'dockerfile', '.html': 'html', '.svg': 'xml', '.example': 'ini'}
sys.path.insert(0, os.path.dirname(__file__))

def match(line, anchor):
    if anchor.startswith('='):
        return line.strip() == anchor[1:]
    if anchor[:1].isspace():
        return line.startswith(anchor)  # indentação exata
    return anchor in line

def render(path, intro, notes):
    lines = open(os.path.join(ROOT, path), encoding='utf-8').read().replace('\r\n', '\n').rstrip('\n').split('\n')
    starts, pos = [], 0
    for anchor, _ in notes:
        for i in range(pos, len(lines)):
            parts = [x for x in anchor.split('\n') if x] if '\n' in anchor else [anchor]
            if i + len(parts) > len(lines):
                continue
            if all(match(lines[i + k], a) for k, a in enumerate(parts)):
                starts.append(i); pos = i + 1; break
        else:
            raise SystemExit(f'ÂNCORA NÃO ENCONTRADA em {path}: {anchor!r}')
    starts[0] = 0
    name = os.path.basename(path)
    ext = os.path.splitext(path)[1]
    lang = {'Dockerfile': 'dockerfile', '.gitignore': 'gitignore', '.gitattributes': 'gitattributes', '.dockerignore': 'gitignore'}.get(name) or LANG.get(ext, '')
    md = [f'## `{path}`', '', intro.strip(), '']
    for k, (start, (_, text)) in enumerate(zip(starts, notes)):
        end = (starts[k + 1] if k + 1 < len(starts) else len(lines)) - 1
        while end > start and not lines[end].strip():
            end -= 1
        label = f'Linha {start + 1}' if start == end else f'Linhas {start + 1} a {end + 1}'
        md += [f'**{label}**', '', f'```{lang}', *lines[start:end + 1], '```', '', text.strip(), '']
    return '\n'.join(md), len(lines)

def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    index = []
    for mod in sorted(f[:-3] for f in os.listdir(os.path.dirname(__file__)) if f.startswith('ann_') and f.endswith('.py')):
        m = importlib.import_module(mod)
        parts = [f'# {m.TITLE}', '', m.INTRO.strip(), '']
        for path, intro, notes in m.FILES:
            body, n = render(path, intro, notes)
            total += n
            parts += [body, '---', '']
        name = f'{m.SLUG}.md'
        open(os.path.join(OUT, name), 'w', encoding='utf-8').write('\n'.join(parts))
        index.append((name, m.TITLE, [p for p, _, _ in m.FILES]))
        print(f'{name}: {len(m.FILES)} arquivos')
    print('linhas documentadas:', total)
    return index

def write_index(idx):
    md = ['# Documentação do código, linha por linha', '',
          'Cada arquivo do projeto aparece dividido em trechos numerados, com o código real e a explicação logo abaixo.',
          'A ordem segue o caminho de quem está conhecendo o sistema: primeiro como ele sobe, depois o banco e as regras,',
          'as rotas da API e, por fim, a interface.', '',
          'Para a visão geral (arquitetura, requisitos e testes) veja [DOCUMENTACAO.md](../../DOCUMENTACAO.md).', '',
          '| Parte | Arquivos |', '|---|---|']
    for name, title, paths in idx:
        md.append(f'| [{title}]({name}) | ' + ', '.join(f'`{p}`' for p in paths) + ' |')
    md += ['', 'Esta documentação é gerada por `docs/gerador/gerar.py`. Depois de mudar o código, rode',
           '`python docs/gerador/gerar.py`: os trechos são atualizados sozinhos, e o script avisa se algum trecho',
           'explicado deixou de existir.', '']
    open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8').write('\n'.join(md))

if __name__ == '__main__':
    idx = main()
    write_index(idx)
