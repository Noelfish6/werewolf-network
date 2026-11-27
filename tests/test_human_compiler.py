import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('human_compiler',Path(__file__).resolve().parents[1]/'scripts/build-human-data.py')
class CompilerTests(unittest.TestCase):
 def test_original_segments_include_hour_timestamps_and_line_offsets(self):
  self.assertTrue(Path(spec.origin).exists(),'generic source compiler must exist')
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  text='# 原稿\n\n發言人 \\(2\\) 01:02:03\n我是好人。\n\n發言人 \\(1\\) 01:03:02\n结束。\n'
  rows=module.parse_source(text,'H3')
  self.assertEqual(len(rows),2);self.assertEqual(rows[0]['time_seconds'],3723)
  self.assertEqual(rows[0]['source_line_start'],3);self.assertEqual(rows[0]['raw_text'],'我是好人。')
if __name__=='__main__':unittest.main()
