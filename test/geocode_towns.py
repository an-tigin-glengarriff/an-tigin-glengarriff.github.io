"""Village anchors for west of Cork and around Macroom. No network."""
import json, math, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import update_events as geo

HOME = (51.7283264, -9.5554595)
# The other Kilmichael, in north Cork, which a bare search returns.
NORTH_CORK_KILMICHAEL = (52.14639, -8.74444)

def km(a, b):
    r = math.pi / 180
    dl = (b[1] - a[1]) * r
    dp = (b[0] - a[0]) * r
    x = math.sin(dp / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin(dl / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))

class TownAnchors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(geo.CACHE) as f:
            cls.cache = json.load(f)

    def test_names_resolve(self):
        cases = [
            ("Wolfe Tone Square, Bantry", "Bantry"),
            ("Black's Brewery & Distillery, Kinsale", "Kinsale"),
            ("Main Street, Ballydehob, Co. Cork", "Ballydehob"),
            ("Macroom", "Macroom"),
            ("Kilmichael", "Kilmichael"),
            ("Kilmichael, Macroom", "Kilmichael"),
            ("Coachford, near Macroom", "Coachford"),
            ("Farran, Co. Cork", "Farran"),
            ("Farranfore", None),
            ("Ballymakeery", "Ballymakeera"),
            ("Béal na Bláth", "Beal na Blath"),
            ("Bealnablath", "Beal na Blath"),
            ("Inchigeelagh hall", "Inchigeelagh"),
            ("Ballingeary", "Ballingeary"),
            ("Innishannon", "Innishannon"),
            ("Belgooly", "Belgooly"),
        ]
        for loc, town in cases:
            self.assertEqual(geo._town_in(loc), town, loc)

    def test_kilmichael_query_names_macroom(self):
        q = geo.TOWN_QUERY["Kilmichael"]
        self.assertIn("Macroom", q)
        self.assertNotEqual(q, "Kilmichael, Ireland")

    def test_cached_villages_are_inside_75km_and_kilmichael_is_macroom(self):
        representative = [
            "Ballyvourney", "Ballymakeera", "Coolea", "Ballingeary", "Inchigeelagh",
            "Kilnamartyra", "Clondrohid", "Carrigadrohid", "Kilmichael", "Coachford",
            "Dripsey", "Farran", "Crookstown", "Lissarda", "Farnanes", "Aghabullogue",
            "Donoughmore", "Rylane", "Innishannon", "Ballinhassig", "Crossbarry",
            "Belgooly", "Halfway", "Upton", "Enniskeane", "Ballineen", "Coppeen",
            "Newcestown", "Beal na Blath", "Macroom", "Kinsale", "Bandon",
        ]
        macroom = self.cache["town:Macroom"]
        for name in representative:
            pos = self.cache["town:" + name]
            d = km(HOME, (pos["lat"], pos["lng"]))
            self.assertLessEqual(d, 75, "%s is %.1f km away" % (name, d))
            got = geo.geocode(name, dict(self.cache))
            self.assertAlmostEqual(got["lat"], pos["lat"], places=5)
            self.assertAlmostEqual(got["lng"], pos["lng"], places=5)
        kmichael = self.cache["town:Kilmichael"]
        self.assertLess(km((kmichael["lat"], kmichael["lng"]), (macroom["lat"], macroom["lng"])), 20)
        self.assertGreater(km((kmichael["lat"], kmichael["lng"]), NORTH_CORK_KILMICHAEL), 25)
        spelled = geo.geocode("Kilmichael, Macroom", dict(self.cache))
        self.assertAlmostEqual(spelled["lat"], kmichael["lat"], places=5)
        self.assertAlmostEqual(spelled["lng"], kmichael["lng"], places=5)
        alias = geo.geocode("Ballymakeery", dict(self.cache))
        self.assertAlmostEqual(alias["lat"], self.cache["town:Ballymakeera"]["lat"], places=5)
        blath = geo.geocode("Béal na Bláth", dict(self.cache))
        self.assertAlmostEqual(blath["lat"], self.cache["town:Beal na Blath"]["lat"], places=5)

if __name__ == "__main__":
    unittest.main()
