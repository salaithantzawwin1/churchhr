-- Canonical grade labels (KG, G1 … G12) so the Hope School report groups and
-- sorts one way, however a grade was typed ("kg", "K.G.", "Grade 5", "g5", "5").
-- A label this cannot read (e.g. "Year 13") is left exactly as it was.

UPDATE pastor_children
SET grade = fixed.canonical
FROM (
  SELECT src.id,
         CASE
           WHEN src.norm IN ('KG', 'KINDERGARTEN', 'PREKG', 'PRE', 'KG1', 'KG2') THEN 'KG'
           WHEN src.num <> '' AND src.num NOT GLOB '*[^0-9]*'
                AND CAST(src.num AS INTEGER) BETWEEN 1 AND 12
             THEN 'G' || CAST(src.num AS INTEGER)
           ELSE NULL
         END AS canonical
  FROM (
    SELECT id,
           UPPER(REPLACE(REPLACE(REPLACE(TRIM(grade), ' ', ''), '.', ''), '-', '')) AS norm,
           REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             UPPER(REPLACE(REPLACE(REPLACE(TRIM(grade), ' ', ''), '.', ''), '-', '')),
             'GRADE', ''), 'CLASS', ''), 'STANDARD', ''), 'STD', ''), 'YEAR', ''), 'G', '') AS num
    FROM pastor_children
    WHERE grade IS NOT NULL AND TRIM(grade) <> ''
  ) AS src
) AS fixed
WHERE fixed.id = pastor_children.id AND fixed.canonical IS NOT NULL;

UPDATE student_enrolments
SET grade = fixed.canonical
FROM (
  SELECT src.id,
         CASE
           WHEN src.norm IN ('KG', 'KINDERGARTEN', 'PREKG', 'PRE', 'KG1', 'KG2') THEN 'KG'
           WHEN src.num <> '' AND src.num NOT GLOB '*[^0-9]*'
                AND CAST(src.num AS INTEGER) BETWEEN 1 AND 12
             THEN 'G' || CAST(src.num AS INTEGER)
           ELSE NULL
         END AS canonical
  FROM (
    SELECT id,
           UPPER(REPLACE(REPLACE(REPLACE(TRIM(grade), ' ', ''), '.', ''), '-', '')) AS norm,
           REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             UPPER(REPLACE(REPLACE(REPLACE(TRIM(grade), ' ', ''), '.', ''), '-', '')),
             'GRADE', ''), 'CLASS', ''), 'STANDARD', ''), 'STD', ''), 'YEAR', ''), 'G', '') AS num
    FROM student_enrolments
    WHERE grade IS NOT NULL AND TRIM(grade) <> ''
  ) AS src
) AS fixed
WHERE fixed.id = student_enrolments.id AND fixed.canonical IS NOT NULL;
