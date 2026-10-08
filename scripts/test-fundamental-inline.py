import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('prepare', pathlib.Path(__file__).with_name('prepare-fundamental-fixtures.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InlineProofChecks(unittest.TestCase):
    def source(self, *, member='', unit='iso4217:USD', attributes='', text='1,234', cik='0000885590'):
        return f'''<xbrli:context id="c1"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">{cik}</xbrli:identifier>{member}</xbrli:entity><xbrli:period><xbrli:startDate>2026-04-01</xbrli:startDate><xbrli:endDate>2026-06-30</xbrli:endDate></xbrli:period></xbrli:context><xbrli:unit id="u1"><xbrli:measure>{unit}</xbrli:measure></xbrli:unit><ix:nonFraction id="f1" name="us-gaap:Revenues" contextRef="c1" unitRef="u1" {attributes}>{text}</ix:nonFraction>'''.encode()

    def extract(self, **kwargs):
        return module.extract_proofs(self.source(**kwargs), '0000885590')

    def test_sign_scale_and_period(self):
        fact = self.extract(attributes='scale="6" sign="-" format="ixt:num-dot-decimal"')[0]
        self.assertEqual(fact['value'], -1234000000)
        self.assertEqual((fact['start'], fact['end']), ('2026-04-01', '2026-06-30'))

    def test_cad_is_excluded(self):
        self.assertEqual(self.extract(unit='iso4217:CAD'), [])

    def test_dimensional_fact_is_excluded(self):
        self.assertEqual(self.extract(member='<xbrli:segment><xbrldi:explicitMember>Division</xbrldi:explicitMember></xbrli:segment>'), [])

    def test_wrong_issuer_is_excluded(self):
        self.assertEqual(self.extract(cik='0001326801'), [])

    def test_unknown_transform_and_nil_are_excluded(self):
        self.assertEqual(self.extract(attributes='format="unknown:money"'), [])
        self.assertEqual(self.extract(attributes='xsi:nil="true"'), [])

    def test_zero_is_numeric_and_unparsed_dash_is_not_guessed(self):
        self.assertEqual(self.extract(text='0')[0]['value'], 0)
        self.assertEqual(self.extract(text='—'), [])


if __name__ == '__main__':
    unittest.main()
