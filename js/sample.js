'use strict';
/* 多语平行语料对齐工作台 —— 内置示例（自创文本，6 个版本，其中英文版含一处 1-2 对齐演示） */
PA.SAMPLE = {
  name: '多语平行语料库构建入门',
  versions: [
    {
      name: '中文原文', lang: 'zh-CN',
      text: [
        '平行语料库是翻译研究和机器翻译系统的重要基础。',
        '构建平行语料库的第一步，是收集同一文本的多个版本。',
        '这些版本通常包括原文和至少一种译文。',
        '第二步是对齐，即让不同语言的句子一一对应起来。',
        '对齐算法主要依据句子长度和结构特征进行判断。',
        '长度相似的两个句子，很可能是彼此的译文。',
        '数字、日期和专有名词也能提供有用的线索。',
        '自动对齐的准确率通常可以达到95%以上。',
        '然而，长句的拆分与合并仍然需要人工审校。',
        '审校完成后，语料可以导出为TMX格式。',
        'TMX是翻译记忆交换的国际标准。',
        '多语对齐的语料库可以同时支持多种语言对。',
        '这样的资源对语言服务行业具有很高的价值。',
        '希望这个工具能让语料库构建变得更加高效。'
      ].join('\n')
    },
    {
      name: 'English', lang: 'en',
      text: [
        'A parallel corpus is an important foundation for translation studies and machine translation systems.',
        'The first step in building a parallel corpus is to collect multiple versions of the same text.',
        'These versions usually include the source text and at least one translation.',
        'The second step is alignment, that is, matching the sentences of different languages with each other.',
        'Alignment algorithms are mainly based on sentence length and structural features.',
        'Two sentences of similar length are very likely to be translations of each other.',
        'Numbers, dates and proper names can also provide useful clues.',
        'The accuracy of automatic alignment can usually reach more than 95%.',
        'However, cases where a long sentence is split or merged',
        'still require manual review.',
        'After review, the corpus can be exported in the TMX format.',
        'TMX is the international standard for translation memory exchange.',
        'A multilingual aligned corpus can support multiple language pairs at the same time.',
        'Such resources are highly valuable to the language services industry.',
        'We hope that this tool will make corpus building more efficient.'
      ].join('\n')
    },
    {
      name: '日本語', lang: 'ja',
      text: [
        '平行コーパスは、翻訳研究や機械翻訳システムの重要な基盤である。',
        '平行コーパスを構築する第一歩は、同じテキストの複数の版を収集することです。',
        'これらの版には、通常、原文と少なくとも一つの訳文が含まれます。',
        '第二のステップはアラインメント、つまり異なる言語の文を互いに対応させることです。',
        'アラインメントのアルゴリズムは、主に文の長さと構造的な特徴に基づいています。',
        '長さが似ている二つの文は、互いの訳文である可能性が高いです。',
        '数字、日付、固有名詞も有用な手がかりになります。',
        '自動アラインメントの精度は、通常95%以上に達することができます。',
        'しかし、長い文の分割や統合の場合には、依然として人間による校正が必要です。',
        '校正が終わると、コーパスはTMX形式で書き出せます。',
        'TMXは翻訳メモリ交換の国際標準です。',
        '多言語にアラインメントされたコーパスは、複数の言語ペアを同時にサポートできます。',
        'このような資源は、言語サービス産業にとって高い価値があります。',
        'このツールが、コーパス構築をより効率的にすることを願っています。'
      ].join('\n')
    },
    {
      name: 'Français', lang: 'fr',
      text: [
        'Un corpus parallèle est un fondement important pour la recherche en traduction et les systèmes de traduction automatique.',
        'La première étape de la construction d\u2019un corpus parallèle consiste à collecter plusieurs versions du même texte.',
        'Ces versions comprennent généralement le texte original et au moins une traduction.',
        'La deuxième étape est l\u2019alignement, c\u2019est-à-dire la mise en correspondance des phrases dans différentes langues.',
        'Les algorithmes d\u2019alignement reposent principalement sur la longueur des phrases et leurs caractéristiques structurelles.',
        'Deux phrases de longueur similaire sont très probablement des traductions l\u2019une de l\u2019autre.',
        'Les nombres, les dates et les noms propres fournissent également des indices utiles.',
        'La précision de l\u2019alignement automatique peut généralement dépasser 95%.',
        'Cependant, les cas de division ou de fusion de phrases longues exigent encore une révision manuelle.',
        'Après la révision, le corpus peut être exporté au format TMX.',
        'TMX est la norme internationale d\u2019échange des mémoires de traduction.',
        'Un corpus aligné multilingue peut prendre en charge plusieurs paires de langues à la fois.',
        'De telles ressources présentent une grande valeur pour l\u2019industrie des services linguistiques.',
        'Nous espérons que cet outil rendra la construction de corpus plus efficace.'
      ].join('\n')
    },
    {
      name: 'Deutsch', lang: 'de',
      text: [
        'Ein Parallelkorpus ist eine wichtige Grundlage für die Übersetzungsforschung und maschinelle Übersetzungssysteme.',
        'Der erste Schritt beim Aufbau eines Parallelkorpus besteht darin, mehrere Versionen desselben Textes zu sammeln.',
        'Diese Versionen umfassen in der Regel den Ausgangstext und mindestens eine Übersetzung.',
        'Der zweite Schritt ist das Alignment, also die Zuordnung von Sätzen in verschiedenen Sprachen zueinander.',
        'Alignment-Algorithmen beruhen hauptsächlich auf Satzlänge und strukturellen Merkmalen.',
        'Zwei Sätze ähnlicher Länge sind sehr wahrscheinlich Übersetzungen voneinander.',
        'Zahlen, Daten und Eigennamen liefern ebenfalls nützliche Hinweise.',
        'Die Genauigkeit des automatischen Alignments erreicht in der Regel mehr als 95%.',
        'Allerdings erfordern Fälle, in denen ein langer Satz geteilt oder zusammengeführt wird, weiterhin eine manuelle Prüfung.',
        'Nach der Prüfung kann das Korpus ins TMX-Format exportiert werden.',
        'TMX ist der internationale Standard für den Austausch von Übersetzungsspeichern.',
        'Ein mehrsprachig ausgerichtetes Korpus kann mehrere Sprachpaare gleichzeitig unterstützen.',
        'Solche Ressourcen sind für die Sprachdienstleistungsbranche sehr wertvoll.',
        'Wir hoffen, dass dieses Werkzeug den Korpusaufbau effizienter macht.'
      ].join('\n')
    },
    {
      name: 'Español', lang: 'es',
      text: [
        'Un corpus paralelo es una base importante para la investigación de la traducción y los sistemas de traducción automática.',
        'El primer paso para construir un corpus paralelo es recolectar varias versiones del mismo texto.',
        'Estas versiones suelen incluir el texto original y al menos una traducción.',
        'El segundo paso es la alineación, es decir, hacer corresponder entre sí las oraciones de diferentes idiomas.',
        'Los algoritmos de alineación se basan principalmente en la longitud de las oraciones y sus características estructurales.',
        'Dos oraciones de longitud similar muy probablemente sean traducciones una de otra.',
        'Los números, las fechas y los nombres propios también proporcionan pistas útiles.',
        'La precisión de la alineación automática suele superar el 95%.',
        'Sin embargo, los casos de división o fusión de oraciones largas aún requieren revisión manual.',
        'Después de la revisión, el corpus se puede exportar en formato TMX.',
        'TMX es el estándar internacional para el intercambio de memorias de traducción.',
        'Un corpus multilingüe alineado puede admitir varios pares de idiomas al mismo tiempo.',
        'Estos recursos tienen un gran valor para la industria de los servicios lingüísticos.',
        'Esperamos que esta herramienta haga que la construcción de corpus sea más eficiente.'
      ].join('\n')
    }
  ]
};
