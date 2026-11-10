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
            ("Bantry & Ballylickey, around Bantry Bay", "Bantry"),
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

# Location strings copied from the public West Cork Events calendar.
CALENDAR = {
    "Paddy Mac's, Main Street, Coachford, Co. Cork, P12 T448": "Coachford",
    "Independence Museum Kilmurry, Co. Cork, P14 R940": "Kilmurry",
    "Church of Christ Our Light, Ballincollig, Co. Cork": "Ballincollig",
    "West Square, Macroom, Co. Cork": "Macroom",
    "Ionad Cultúrtha an Dochtúir Ó Loingsigh, Baile Mhúirne, Co. Cork, P12 X239": "Ballyvourney",
    "Ballyvourney Library, Baile Mhic Íre / Ballymakeera, Co. Cork": "Ballymakeera",
    # Two villages. The pin is Cúil Aodha (Coolea), named first and the festival's home place.
    "Cúil Aodha and Baile Mhúirne, Gaeltacht Mhúscraí, Co. Cork": "Coolea",
}

class CalendarLocations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(geo.CACHE) as f:
            cls.cache = json.load(f)

    def test_irish_spellings_and_real_locations_name_the_village(self):
        names = {
            "Baile Mhúirne": "Ballyvourney",
            "Baile Mhuirne": "Ballyvourney",
            "Baile Bhuirne": "Ballyvourney",
            "Cúil Aodha": "Coolea",
            "Cuil Aodha": "Coolea",
            "Baile Mhic Íre": "Ballymakeera",
            "Baile Mhic Ire": "Ballymakeera",
            "Cill Muire": "Kilmurry",
            "Kilmurry": "Kilmurry",
            "Ballincollig": "Ballincollig",
        }
        names.update(CALENDAR)
        for loc, town in names.items():
            self.assertEqual(geo._town_in(loc), town, loc)
        for spelling, town in (
            ("Baile Mhúirne", "Ballyvourney"), ("Baile Bhuirne", "Ballyvourney"),
            ("Cúil Aodha", "Coolea"), ("Cuil Aodha", "Coolea"),
            ("Baile Mhic Íre", "Ballymakeera"), ("Cill Muire", "Kilmurry"),
        ):
            got = geo.geocode(spelling, dict(self.cache))
            anchor = self.cache["town:" + town]
            self.assertAlmostEqual(got["lat"], anchor["lat"], places=5, msg=spelling)
            self.assertAlmostEqual(got["lng"], anchor["lng"], places=5, msg=spelling)

    def test_calendar_locations_are_inside_75km_of_an_tigin(self):
        for loc, town in CALENDAR.items():
            got = geo.geocode(loc, dict(self.cache))
            self.assertIsNotNone(got, loc)
            d = km(HOME, (got["lat"], got["lng"]))
            self.assertLessEqual(d, 75, "%s is %.1f km" % (loc, d))
            anchor = self.cache["town:" + town]
            self.assertLess(km((got["lat"], got["lng"]), (anchor["lat"], anchor["lng"])), 15, loc)
        # Kilmurry is the Lissarda village, and Ballincollig is west of Cork but inside the limit.
        for town in ("Kilmurry", "Ballincollig"):
            pos = self.cache["town:" + town]
            self.assertLessEqual(km(HOME, (pos["lat"], pos["lng"])), 75, town)

    def test_venue_fallback_uses_the_village_when_the_building_is_not_found(self):
        def missing(q):
            return None, True
        orig = geo._nominatim
        geo._nominatim = missing
        try:
            for loc, town in CALENDAR.items():
                cache = dict(self.cache)
                cache.pop(loc, None)
                got = geo.geocode(loc, cache)
                anchor = self.cache["town:" + town]
                self.assertAlmostEqual(got["lat"], anchor["lat"], places=5, msg=loc)
                self.assertAlmostEqual(got["lng"], anchor["lng"], places=5, msg=loc)
        finally:
            geo._nominatim = orig

if __name__ == "__main__":
    unittest.main()
