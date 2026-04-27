Génère un document Word .docx à partir du texte généré, en suivant exactement le design de Majalis Furqan.html.
Stack : Python avec python-docx (ou Node avec docx).
Structure attendue (dans cet ordre) :
1.	Page de couverture : basmala centrée, eyebrow « تــدبّــر », titre « مَجالِسُ التَّدَبُّر », sous-titre « من سُورة xxx », range « الآيات –  » dans encadré or.
2.	Sommaire avec leaders pointés.
3.	Pour chaque مَجلِس : 4 sous-sections numérotées (١ كلمات الابتلاء, ٢ البيان العام, ٣ الهدى المنهاجي, ٤ مسلك التخلق).
4.	خَتْم السورة : 3 sous-sections (المحور, القضايا, الثمرة).
5.	Clôture « والحمد لله رب العالمين ».
Styles Word à créer (via styles.xml ou add_style) :
•	Title-Cover : Reem Kufi 46pt, gras, centré
•	Section-H1 : Reem Kufi 24pt, gras, centré, bordure inférieure or 2pt
•	Majlis-H2 : Reem Kufi 20pt, fond #F1E6CA, bordure gauche or 3pt
•	Sub-H3 : Reem Kufi 14pt, bordure inférieure pointillée or
•	Body-Arabic : Amiri 13pt, justifié, RTL, interligne 2.0
•	Ayah-Box : Amiri 17pt, centré, encadré or #A87A2A, fond gradient #F1E6CA → #FCF7E7
•	Quote : Amiri 13pt italique, fond #FAF4E2, bordure gauche or 3pt
Tokens : ink #1F1A12, gold #A87A2A, gold-deep #7A5921, gold-wash #F1E6CA, paper #FBF8F1.
Réglages : page A4, marges 2,2 cm, direction RTL globale (w:bidi), polices arabes embarquées si possible. Numéros de page 
Garde les citations (Ibn ʿĀshūr, Ṭabarī, hadith de Bukhārī) avec leurs attributions.
Livrable final : Majalis_ « nom sourat »_ « num aya de à « .docx (exemple Majlis_Frqan_14_18.docx) ouvrable nativement dans Word/LibreOffice avec mise en page identique au HTML.
