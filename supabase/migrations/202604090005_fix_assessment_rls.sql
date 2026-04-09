-- Perbaikan RLS agar guru hanya dapat menilai siswa yang benar-benar di-assign.

drop policy if exists "assessments_insert_teacher_or_admin" on public.quran_assessments;
create policy "assessments_insert_teacher_or_admin"
on public.quran_assessments
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid() = teacher_id
    and exists (
      select 1
      from public.teacher_student_assignments tsa
      where tsa.teacher_id = auth.uid()
        and tsa.student_id = quran_assessments.student_id
    )
  )
);
