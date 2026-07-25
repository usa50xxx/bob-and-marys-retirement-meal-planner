(function installSupperloomStarterRecipes(root) {
  "use strict";

  const ingredient = (amount, unit, name) => ({ amount, unit, name });
  const recipe = (name, servings, image, prepTime, cookTime, temperature, ingredients, steps) => ({
    id: `starter-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    baseServings: servings,
    prepTime,
    cookTime,
    totalTime: "",
    temperature,
    sourceUrl: "",
    photo: `images/ingredients/${image}.webp`,
    ingredients,
    notes: steps.join("\n")
  });

  root.SUPPERLOOM_STARTER_RECIPES = [
    recipe("Lemon Chicken Pasta", 4, "chicken_breast", "15 minutes", "25 minutes", "165 F", [
      ingredient(1.5, "lb", "boneless chicken breasts"), ingredient(12, "oz", "pasta"),
      ingredient(1, "count", "lemon"), ingredient(2, "tbsp", "olive oil"),
      ingredient(2, "cloves", "garlic"), ingredient(0.5, "cup", "parmesan")
    ], ["Cook pasta and save 1/2 cup pasta water.", "Brown sliced chicken in olive oil until it reaches 165 F.", "Add garlic, lemon juice, pasta, parmesan, and enough pasta water to coat."]),
    recipe("Taco Night", 4, "ground_beef", "15 minutes", "15 minutes", "160 F", [
      ingredient(1, "lb", "ground beef"), ingredient(12, "count", "tortillas"),
      ingredient(1, "packet", "taco seasoning"), ingredient(2, "cups", "shredded lettuce"),
      ingredient(1, "cup", "shredded cheese"), ingredient(1, "cup", "salsa")
    ], ["Brown ground beef to 160 F and drain.", "Stir in taco seasoning and water according to the packet.", "Warm tortillas and serve with lettuce, cheese, and salsa."]),
    recipe("Classic Meatloaf", 6, "ground_beef", "15 minutes", "60 minutes", "350 F", [
      ingredient(2, "lb", "ground beef"), ingredient(2, "count", "eggs"),
      ingredient(1, "cup", "breadcrumbs"), ingredient(1, "packet", "onion soup mix"),
      ingredient(0.75, "cup", "ketchup"), ingredient(0.5, "tsp", "black pepper")
    ], ["Heat oven to 350 F.", "Mix beef, eggs, breadcrumbs, soup mix, half the ketchup, and pepper.", "Shape into a loaf, top with remaining ketchup, and bake to 160 F. Rest 10 minutes."]),
    recipe("Skillet Hamburgers", 4, "ground_beef", "10 minutes", "12 minutes", "160 F", [
      ingredient(1.5, "lb", "ground beef"), ingredient(4, "count", "hamburger buns"),
      ingredient(1, "tsp", "salt"), ingredient(0.5, "tsp", "black pepper"),
      ingredient(4, "slices", "cheese"), ingredient(1, "count", "tomato")
    ], ["Shape beef into four patties and season.", "Cook in a hot skillet about 4 to 6 minutes per side to 160 F.", "Add cheese for the final minute and serve on buns with tomato."]),
    recipe("Beef Pot Roast", 6, "beef_roast", "20 minutes", "3 hours", "325 F", [
      ingredient(3, "lb", "chuck roast"), ingredient(1, "lb", "potatoes"),
      ingredient(4, "count", "carrots"), ingredient(1, "count", "onion"),
      ingredient(2, "cups", "beef broth"), ingredient(1, "tbsp", "Worcestershire sauce")
    ], ["Heat oven to 325 F and brown the roast in a Dutch oven.", "Add vegetables, broth, and Worcestershire sauce.", "Cover and cook until fork tender, about 3 hours."]),
    recipe("Beef Stew", 6, "stew_meat", "20 minutes", "2 hours", "325 F", [
      ingredient(2, "lb", "beef stew meat"), ingredient(1, "lb", "potatoes"),
      ingredient(4, "count", "carrots"), ingredient(1, "count", "onion"),
      ingredient(4, "cups", "beef broth"), ingredient(2, "tbsp", "flour")
    ], ["Coat beef with flour and brown in a heavy pot.", "Add chopped vegetables and broth.", "Cover and simmer gently or bake at 325 F until beef is tender."]),
    recipe("Salisbury Steak", 4, "ground_beef", "15 minutes", "25 minutes", "160 F", [
      ingredient(1.5, "lb", "ground beef"), ingredient(0.5, "cup", "breadcrumbs"),
      ingredient(1, "count", "egg"), ingredient(1, "count", "onion"),
      ingredient(2, "cups", "beef gravy"), ingredient(8, "oz", "mushrooms")
    ], ["Mix beef, breadcrumbs, egg, and half the onion; shape four patties.", "Brown patties to 160 F and remove.", "Cook remaining onion and mushrooms, add gravy, return patties, and simmer 10 minutes."]),
    recipe("Beef Stroganoff", 4, "sirloin", "15 minutes", "25 minutes", "145 F", [
      ingredient(1.5, "lb", "sirloin steak"), ingredient(8, "oz", "mushrooms"),
      ingredient(1, "count", "onion"), ingredient(2, "cups", "beef broth"),
      ingredient(0.75, "cup", "sour cream"), ingredient(12, "oz", "egg noodles")
    ], ["Cook noodles.", "Brown thinly sliced steak, then cook onion and mushrooms.", "Add broth and simmer; remove from heat, stir in sour cream, and serve over noodles."]),
    recipe("Sloppy Joes", 6, "ground_beef", "10 minutes", "20 minutes", "160 F", [
      ingredient(1.5, "lb", "ground beef"), ingredient(1, "count", "onion"),
      ingredient(1, "cup", "tomato sauce"), ingredient(0.25, "cup", "ketchup"),
      ingredient(1, "tbsp", "Worcestershire sauce"), ingredient(6, "count", "hamburger buns")
    ], ["Brown beef and onion to 160 F; drain.", "Stir in tomato sauce, ketchup, and Worcestershire sauce.", "Simmer 10 minutes and spoon onto buns."]),
    recipe("Steak and Baked Potato", 4, "ribeye", "10 minutes", "50 minutes", "425 F", [
      ingredient(4, "count", "steaks"), ingredient(4, "count", "russet potatoes"),
      ingredient(2, "tbsp", "olive oil"), ingredient(1, "tsp", "salt"),
      ingredient(0.5, "tsp", "black pepper"), ingredient(4, "tbsp", "butter")
    ], ["Heat oven to 425 F and bake scrubbed potatoes until tender.", "Season steaks and cook in a hot skillet or grill to preferred doneness.", "Rest steaks 5 minutes and serve with split potatoes and butter."]),
    recipe("Chicken Parmesan", 4, "chicken_cutlets", "20 minutes", "25 minutes", "400 F", [
      ingredient(4, "count", "chicken cutlets"), ingredient(1, "cup", "breadcrumbs"),
      ingredient(1, "count", "egg"), ingredient(2, "cups", "marinara sauce"),
      ingredient(1, "cup", "mozzarella cheese"), ingredient(0.25, "cup", "parmesan")
    ], ["Heat oven to 400 F.", "Dip chicken in beaten egg and breadcrumbs; brown lightly.", "Top with sauce and cheese and bake until chicken reaches 165 F."]),
    recipe("Oven Roasted Chicken", 6, "whole_chicken", "15 minutes", "90 minutes", "375 F", [
      ingredient(1, "count", "whole chicken"), ingredient(2, "tbsp", "butter"),
      ingredient(1, "tsp", "salt"), ingredient(0.5, "tsp", "black pepper"),
      ingredient(1, "tsp", "garlic powder"), ingredient(1, "count", "lemon")
    ], ["Heat oven to 375 F.", "Pat chicken dry, rub with butter and seasonings, and place lemon inside.", "Roast until the thickest breast and thigh reach 165 F; rest 15 minutes."]),
    recipe("Chicken and Rice", 6, "chicken_thighs", "15 minutes", "50 minutes", "375 F", [
      ingredient(6, "count", "chicken thighs"), ingredient(1.5, "cups", "long grain rice"),
      ingredient(3, "cups", "chicken broth"), ingredient(1, "count", "onion"),
      ingredient(1, "tsp", "garlic powder"), ingredient(1, "tsp", "paprika")
    ], ["Heat oven to 375 F.", "Place rice, broth, and onion in a baking dish; set seasoned thighs on top.", "Cover 30 minutes, uncover, and bake until rice is tender and chicken reaches 165 F."]),
    recipe("Chicken Noodle Soup", 6, "chicken_breast", "15 minutes", "35 minutes", "165 F", [
      ingredient(1, "lb", "chicken breasts"), ingredient(8, "cups", "chicken broth"),
      ingredient(3, "count", "carrots"), ingredient(3, "stalks", "celery"),
      ingredient(1, "count", "onion"), ingredient(8, "oz", "egg noodles")
    ], ["Simmer chicken in broth until it reaches 165 F; remove and shred.", "Add chopped vegetables and simmer until tender.", "Add noodles and chicken and cook until noodles are done."]),
    recipe("BBQ Chicken Thighs", 4, "chicken_thighs", "10 minutes", "40 minutes", "400 F", [
      ingredient(8, "count", "chicken thighs"), ingredient(1, "cup", "barbecue sauce"),
      ingredient(1, "tbsp", "olive oil"), ingredient(1, "tsp", "paprika"),
      ingredient(0.5, "tsp", "garlic powder"), ingredient(0.5, "tsp", "salt")
    ], ["Heat oven to 400 F.", "Season chicken and bake skin-side up for 25 minutes.", "Brush with barbecue sauce and bake until chicken reaches 165 F."]),
    recipe("Chicken Alfredo", 4, "chicken_breast", "15 minutes", "25 minutes", "165 F", [
      ingredient(1.25, "lb", "chicken breasts"), ingredient(12, "oz", "fettuccine"),
      ingredient(1, "cup", "heavy cream"), ingredient(0.75, "cup", "parmesan"),
      ingredient(2, "tbsp", "butter"), ingredient(2, "cloves", "garlic")
    ], ["Cook fettuccine.", "Saute sliced chicken in butter to 165 F and remove.", "Cook garlic briefly, add cream and parmesan, then toss with pasta and chicken."]),
    recipe("Chicken Fajitas", 4, "chicken_breast", "15 minutes", "20 minutes", "165 F", [
      ingredient(1.5, "lb", "chicken breasts"), ingredient(3, "count", "bell peppers"),
      ingredient(1, "count", "onion"), ingredient(1, "packet", "fajita seasoning"),
      ingredient(12, "count", "tortillas"), ingredient(2, "tbsp", "oil")
    ], ["Slice chicken and vegetables.", "Cook chicken with seasoning in oil to 165 F.", "Add peppers and onion, cook until crisp-tender, and serve in warm tortillas."]),
    recipe("Chicken Pot Pie", 6, "chicken_breast", "20 minutes", "40 minutes", "400 F", [
      ingredient(3, "cups", "cooked chicken"), ingredient(2, "cups", "mixed vegetables"),
      ingredient(2, "cups", "chicken gravy"), ingredient(1, "tsp", "thyme"),
      ingredient(2, "count", "pie crusts"), ingredient(1, "count", "egg")
    ], ["Heat oven to 400 F.", "Mix chicken, vegetables, gravy, and thyme in a crust-lined pie dish.", "Top with second crust, vent, brush with egg, and bake until golden and bubbling."]),
    recipe("Honey Garlic Chicken", 4, "chicken_breast", "10 minutes", "20 minutes", "165 F", [
      ingredient(1.5, "lb", "chicken breasts"), ingredient(0.25, "cup", "honey"),
      ingredient(0.25, "cup", "soy sauce"), ingredient(3, "cloves", "garlic"),
      ingredient(1, "tbsp", "oil"), ingredient(1, "tsp", "cornstarch")
    ], ["Brown bite-size chicken in oil to 165 F.", "Stir together honey, soy sauce, garlic, cornstarch, and 1/4 cup water.", "Add sauce and simmer until glossy and thick."]),
    recipe("Pork Chops and Apples", 4, "pork_chops", "15 minutes", "25 minutes", "145 F", [
      ingredient(4, "count", "pork chops"), ingredient(2, "count", "apples"),
      ingredient(1, "count", "onion"), ingredient(1, "tbsp", "butter"),
      ingredient(0.5, "cup", "chicken broth"), ingredient(0.5, "tsp", "cinnamon")
    ], ["Brown seasoned pork chops and cook to 145 F; rest 3 minutes.", "Cook sliced apples and onion in butter.", "Add broth and cinnamon, simmer, and spoon over chops."]),
    recipe("Slow Cooker Pulled Pork", 8, "pork_butt", "15 minutes", "8 hours", "200 F", [
      ingredient(4, "lb", "pork shoulder"), ingredient(1, "count", "onion"),
      ingredient(1, "cup", "barbecue sauce"), ingredient(0.5, "cup", "chicken broth"),
      ingredient(1, "tbsp", "brown sugar"), ingredient(8, "count", "sandwich buns")
    ], ["Place sliced onion and pork in slow cooker.", "Add broth, barbecue sauce, and brown sugar.", "Cook on low until very tender, shred, mix with sauce, and serve on buns."]),
    recipe("Roasted Pork Tenderloin", 4, "pork_tenderloin", "10 minutes", "25 minutes", "425 F", [
      ingredient(1.5, "lb", "pork tenderloin"), ingredient(1, "tbsp", "olive oil"),
      ingredient(1, "tsp", "garlic powder"), ingredient(1, "tsp", "Italian seasoning"),
      ingredient(0.5, "tsp", "salt"), ingredient(0.25, "tsp", "black pepper")
    ], ["Heat oven to 425 F.", "Rub pork with oil and seasonings.", "Roast to 145 F, rest at least 3 minutes, and slice."]),
    recipe("Ham and Bean Soup", 8, "ham", "15 minutes", "75 minutes", "", [
      ingredient(2, "cups", "diced ham"), ingredient(3, "cans", "white beans"),
      ingredient(1, "count", "onion"), ingredient(3, "count", "carrots"),
      ingredient(6, "cups", "chicken broth"), ingredient(1, "tsp", "thyme")
    ], ["Cook onion and carrots until softened.", "Add ham, drained beans, broth, and thyme.", "Simmer 45 to 60 minutes and season to taste."]),
    recipe("Sausage and Peppers", 6, "pork_sausage", "15 minutes", "35 minutes", "400 F", [
      ingredient(2, "lb", "Italian sausage"), ingredient(3, "count", "bell peppers"),
      ingredient(2, "count", "onions"), ingredient(2, "tbsp", "olive oil"),
      ingredient(1, "tsp", "Italian seasoning"), ingredient(6, "count", "hoagie rolls")
    ], ["Heat oven to 400 F.", "Toss sliced peppers and onions with oil and seasoning; add sausage.", "Roast until sausage reaches 160 F, slice, and serve in rolls."]),
    recipe("Baked Pork Ribs", 6, "pork_ribs", "15 minutes", "3 hours", "300 F", [
      ingredient(4, "lb", "pork ribs"), ingredient(2, "tbsp", "brown sugar"),
      ingredient(1, "tbsp", "paprika"), ingredient(1, "tsp", "garlic powder"),
      ingredient(1, "tsp", "salt"), ingredient(1, "cup", "barbecue sauce")
    ], ["Heat oven to 300 F.", "Rub ribs with brown sugar and seasonings; wrap tightly in foil.", "Bake until tender, brush with sauce, and broil briefly to set the glaze."]),
    recipe("Bacon and Egg Breakfast", 4, "bacon", "5 minutes", "20 minutes", "160 F", [
      ingredient(8, "slices", "bacon"), ingredient(8, "count", "eggs"),
      ingredient(4, "slices", "bread"), ingredient(2, "tbsp", "butter"),
      ingredient(0.5, "tsp", "salt"), ingredient(0.25, "tsp", "black pepper")
    ], ["Cook bacon until crisp and drain.", "Cook eggs in a clean skillet until whites and yolks reach the doneness you prefer.", "Toast bread and serve with butter, bacon, and eggs."]),
    recipe("Baked Salmon", 4, "salmon_fillets", "10 minutes", "15 minutes", "400 F", [
      ingredient(4, "count", "salmon fillets"), ingredient(1, "count", "lemon"),
      ingredient(2, "tbsp", "olive oil"), ingredient(1, "tsp", "garlic powder"),
      ingredient(0.5, "tsp", "salt"), ingredient(0.25, "tsp", "black pepper")
    ], ["Heat oven to 400 F.", "Place salmon on a lined pan and season with oil, lemon, garlic, salt, and pepper.", "Bake until fish flakes easily and reaches 145 F."]),
    recipe("Lemon Garlic Shrimp", 4, "shrimp", "10 minutes", "10 minutes", "145 F", [
      ingredient(1.5, "lb", "peeled shrimp"), ingredient(3, "tbsp", "butter"),
      ingredient(4, "cloves", "garlic"), ingredient(1, "count", "lemon"),
      ingredient(0.5, "tsp", "salt"), ingredient(2, "tbsp", "parsley")
    ], ["Melt butter and cook garlic for 30 seconds.", "Add shrimp and cook until opaque and 145 F.", "Finish with lemon juice, salt, and parsley."]),
    recipe("Fish Tacos", 4, "fish_fillets", "15 minutes", "15 minutes", "145 F", [
      ingredient(1.5, "lb", "white fish fillets"), ingredient(12, "count", "tortillas"),
      ingredient(2, "cups", "shredded cabbage"), ingredient(0.5, "cup", "sour cream"),
      ingredient(1, "count", "lime"), ingredient(1, "packet", "taco seasoning")
    ], ["Season fish and cook in a skillet until it reaches 145 F and flakes.", "Mix sour cream with lime juice.", "Break fish into pieces and serve in tortillas with cabbage and lime sauce."]),
    recipe("Baked Cod", 4, "cod", "10 minutes", "15 minutes", "400 F", [
      ingredient(4, "count", "cod fillets"), ingredient(2, "tbsp", "butter"),
      ingredient(1, "count", "lemon"), ingredient(0.5, "tsp", "paprika"),
      ingredient(0.5, "tsp", "garlic powder"), ingredient(0.5, "tsp", "salt")
    ], ["Heat oven to 400 F.", "Place cod in a baking dish and top with butter, lemon, and seasonings.", "Bake until opaque, flaky, and 145 F."]),
    recipe("Tuna Noodle Casserole", 6, "tuna", "15 minutes", "25 minutes", "375 F", [
      ingredient(12, "oz", "egg noodles"), ingredient(2, "cans", "tuna"),
      ingredient(1, "can", "cream of mushroom soup"), ingredient(1, "cup", "frozen peas"),
      ingredient(1, "cup", "milk"), ingredient(1, "cup", "breadcrumbs")
    ], ["Heat oven to 375 F and cook noodles.", "Mix noodles, drained tuna, soup, peas, and milk in a baking dish.", "Top with breadcrumbs and bake until hot and golden."]),
    recipe("Easy Crab Cakes", 4, "crab_cakes", "15 minutes", "12 minutes", "145 F", [
      ingredient(1, "lb", "crab meat"), ingredient(0.75, "cup", "breadcrumbs"),
      ingredient(1, "count", "egg"), ingredient(0.25, "cup", "mayonnaise"),
      ingredient(1, "tsp", "Old Bay seasoning"), ingredient(2, "tbsp", "oil")
    ], ["Mix crab, half the breadcrumbs, egg, mayonnaise, and seasoning.", "Shape eight cakes and coat with remaining breadcrumbs.", "Cook in oil until browned and heated to 145 F."]),
    recipe("Garlic Butter Scallops", 4, "scallops", "10 minutes", "8 minutes", "145 F", [
      ingredient(1.5, "lb", "sea scallops"), ingredient(3, "tbsp", "butter"),
      ingredient(3, "cloves", "garlic"), ingredient(1, "count", "lemon"),
      ingredient(0.5, "tsp", "salt"), ingredient(0.25, "tsp", "black pepper")
    ], ["Pat scallops dry and season.", "Sear in a hot skillet about 2 minutes per side.", "Add butter and garlic, baste briefly, and finish with lemon."]),
    recipe("Spaghetti with Meat Sauce", 6, "spaghetti", "15 minutes", "30 minutes", "160 F", [
      ingredient(1, "lb", "ground beef"), ingredient(16, "oz", "spaghetti"),
      ingredient(24, "oz", "marinara sauce"), ingredient(1, "count", "onion"),
      ingredient(2, "cloves", "garlic"), ingredient(0.5, "cup", "parmesan")
    ], ["Cook spaghetti.", "Brown beef and onion to 160 F; add garlic.", "Stir in marinara, simmer 15 minutes, and serve over pasta with parmesan."]),
    recipe("Baked Ziti", 8, "spaghetti", "20 minutes", "35 minutes", "375 F", [
      ingredient(16, "oz", "ziti"), ingredient(24, "oz", "marinara sauce"),
      ingredient(15, "oz", "ricotta cheese"), ingredient(2, "cups", "mozzarella cheese"),
      ingredient(0.5, "cup", "parmesan"), ingredient(1, "tsp", "Italian seasoning")
    ], ["Heat oven to 375 F and cook ziti just until firm.", "Mix pasta with sauce, ricotta, seasoning, and half the mozzarella.", "Top with remaining cheese and bake until bubbling."]),
    recipe("Classic Lasagna", 8, "lasagna", "30 minutes", "60 minutes", "375 F", [
      ingredient(12, "count", "lasagna noodles"), ingredient(1, "lb", "ground beef"),
      ingredient(24, "oz", "marinara sauce"), ingredient(15, "oz", "ricotta cheese"),
      ingredient(3, "cups", "mozzarella cheese"), ingredient(0.5, "cup", "parmesan")
    ], ["Heat oven to 375 F; cook noodles and brown beef to 160 F.", "Layer sauce, noodles, ricotta, beef, mozzarella, and parmesan.", "Cover and bake 40 minutes, uncover 15 minutes, and rest before cutting."]),
    recipe("Stovetop Mac and Cheese", 6, "macaroni", "10 minutes", "20 minutes", "", [
      ingredient(16, "oz", "elbow macaroni"), ingredient(3, "cups", "cheddar cheese"),
      ingredient(2, "cups", "milk"), ingredient(3, "tbsp", "butter"),
      ingredient(3, "tbsp", "flour"), ingredient(0.5, "tsp", "salt")
    ], ["Cook macaroni.", "Melt butter, whisk in flour, then gradually whisk in milk until thick.", "Remove from heat, melt in cheese, and stir in macaroni."]),
    recipe("Stuffed Shells", 6, "spaghetti", "25 minutes", "35 minutes", "375 F", [
      ingredient(20, "count", "jumbo pasta shells"), ingredient(15, "oz", "ricotta cheese"),
      ingredient(2, "cups", "mozzarella cheese"), ingredient(0.5, "cup", "parmesan"),
      ingredient(1, "count", "egg"), ingredient(24, "oz", "marinara sauce")
    ], ["Heat oven to 375 F and cook shells.", "Mix ricotta, half the mozzarella, parmesan, and egg; fill shells.", "Place over sauce, top with remaining cheese, cover, and bake until hot."]),
    recipe("Hearty Vegetable Soup", 8, "vegetable_broth", "20 minutes", "40 minutes", "", [
      ingredient(8, "cups", "vegetable broth"), ingredient(2, "count", "carrots"),
      ingredient(2, "stalks", "celery"), ingredient(1, "count", "onion"),
      ingredient(1, "can", "diced tomatoes"), ingredient(2, "cups", "mixed vegetables")
    ], ["Cook chopped onion, carrots, and celery until softened.", "Add broth, tomatoes, and mixed vegetables.", "Simmer until all vegetables are tender and season to taste."]),
    recipe("Weeknight Chili", 8, "chili_beans", "15 minutes", "45 minutes", "160 F", [
      ingredient(1.5, "lb", "ground beef"), ingredient(2, "cans", "kidney beans"),
      ingredient(2, "cans", "diced tomatoes"), ingredient(1, "count", "onion"),
      ingredient(2, "tbsp", "chili powder"), ingredient(1, "tsp", "cumin")
    ], ["Brown beef and onion to 160 F and drain.", "Add beans, tomatoes, chili powder, cumin, and 1 cup water.", "Simmer uncovered 30 minutes, stirring occasionally."]),
    recipe("Broccoli Cheddar Soup", 6, "broccoli", "15 minutes", "30 minutes", "", [
      ingredient(4, "cups", "broccoli florets"), ingredient(1, "count", "onion"),
      ingredient(4, "cups", "chicken broth"), ingredient(2, "cups", "milk"),
      ingredient(2, "cups", "cheddar cheese"), ingredient(3, "tbsp", "butter")
    ], ["Cook onion in butter until soft.", "Add broth and broccoli and simmer until tender.", "Stir in milk, warm gently, then remove from heat and melt in cheese."]),
    recipe("Creamy Potato Soup", 8, "potato", "20 minutes", "35 minutes", "", [
      ingredient(2, "lb", "potatoes"), ingredient(1, "count", "onion"),
      ingredient(4, "cups", "chicken broth"), ingredient(2, "cups", "milk"),
      ingredient(4, "slices", "bacon"), ingredient(1, "cup", "cheddar cheese")
    ], ["Cook bacon and set aside; soften onion in a little bacon drippings.", "Add diced potatoes and broth and simmer until tender.", "Mash some potatoes, stir in milk, and serve with bacon and cheese."]),
    recipe("Grilled Cheese and Tomato Soup", 4, "tomato", "10 minutes", "15 minutes", "", [
      ingredient(2, "cans", "tomato soup"), ingredient(2, "cups", "milk"),
      ingredient(8, "slices", "sandwich bread"), ingredient(8, "slices", "cheddar cheese"),
      ingredient(4, "tbsp", "butter"), ingredient(0.25, "tsp", "black pepper")
    ], ["Warm soup with milk and pepper.", "Butter bread, place cheese between slices, and cook sandwiches over medium-low heat.", "Flip until both sides are golden and cheese is melted."]),
    recipe("Chicken Caesar Salad", 4, "chicken_breast", "15 minutes", "15 minutes", "165 F", [
      ingredient(1.25, "lb", "chicken breasts"), ingredient(2, "heads", "romaine lettuce"),
      ingredient(1, "cup", "croutons"), ingredient(0.5, "cup", "parmesan"),
      ingredient(0.75, "cup", "Caesar dressing"), ingredient(1, "count", "lemon")
    ], ["Season and cook chicken to 165 F; rest and slice.", "Chop romaine and toss with dressing, croutons, and parmesan.", "Top with chicken and lemon."]),
    recipe("Classic Chef Salad", 4, "lettuce", "20 minutes", "0 minutes", "", [
      ingredient(1, "head", "lettuce"), ingredient(8, "oz", "deli ham"),
      ingredient(8, "oz", "deli turkey"), ingredient(4, "count", "hard-boiled eggs"),
      ingredient(1, "cup", "cherry tomatoes"), ingredient(1, "cup", "shredded cheese")
    ], ["Wash and chop lettuce.", "Arrange ham, turkey, eggs, tomatoes, and cheese over lettuce.", "Serve with your favorite dressing."]),
    recipe("Tuna Salad Sandwiches", 4, "tuna", "10 minutes", "0 minutes", "", [
      ingredient(2, "cans", "tuna"), ingredient(0.5, "cup", "mayonnaise"),
      ingredient(1, "stalk", "celery"), ingredient(2, "tbsp", "pickle relish"),
      ingredient(8, "slices", "bread"), ingredient(4, "leaves", "lettuce")
    ], ["Drain tuna well.", "Mix tuna with mayonnaise, chopped celery, and relish.", "Serve on bread with lettuce."]),
    recipe("Egg Salad Sandwiches", 4, "eggs", "15 minutes", "12 minutes", "160 F", [
      ingredient(8, "count", "eggs"), ingredient(0.5, "cup", "mayonnaise"),
      ingredient(1, "tsp", "mustard"), ingredient(2, "tbsp", "pickle relish"),
      ingredient(8, "slices", "bread"), ingredient(0.25, "tsp", "black pepper")
    ], ["Hard-boil eggs, cool, peel, and chop.", "Mix with mayonnaise, mustard, relish, and pepper.", "Serve on bread."]),
    recipe("Buttermilk Pancakes", 4, "flour", "10 minutes", "15 minutes", "", [
      ingredient(2, "cups", "all-purpose flour"), ingredient(2, "tbsp", "sugar"),
      ingredient(2, "tsp", "baking powder"), ingredient(2, "count", "eggs"),
      ingredient(1.75, "cups", "buttermilk"), ingredient(3, "tbsp", "melted butter")
    ], ["Whisk dry ingredients.", "Whisk eggs, buttermilk, and butter, then stir gently into dry ingredients.", "Cook 1/4-cup portions on a greased griddle until bubbles form; flip and finish."]),
    recipe("French Toast", 4, "bread", "10 minutes", "12 minutes", "160 F", [
      ingredient(8, "slices", "bread"), ingredient(4, "count", "eggs"),
      ingredient(1, "cup", "milk"), ingredient(1, "tsp", "cinnamon"),
      ingredient(1, "tsp", "vanilla"), ingredient(2, "tbsp", "butter")
    ], ["Whisk eggs, milk, cinnamon, and vanilla.", "Dip bread briefly in egg mixture.", "Cook in butter over medium heat until golden on both sides and egg is set."]),
    recipe("Biscuits and Sausage Gravy", 6, "flour", "10 minutes", "25 minutes", "160 F", [
      ingredient(8, "count", "biscuits"), ingredient(1, "lb", "breakfast sausage"),
      ingredient(0.25, "cup", "flour"), ingredient(3, "cups", "milk"),
      ingredient(0.5, "tsp", "black pepper"), ingredient(0.25, "tsp", "salt")
    ], ["Bake biscuits according to package directions.", "Brown sausage to 160 F; stir flour into drippings.", "Gradually stir in milk and simmer until thick; season and spoon over biscuits."]),
    recipe("Breakfast Burritos", 6, "tortillas", "15 minutes", "20 minutes", "160 F", [
      ingredient(8, "count", "eggs"), ingredient(0.5, "lb", "breakfast sausage"),
      ingredient(1, "cup", "shredded cheese"), ingredient(1, "cup", "diced potatoes"),
      ingredient(6, "count", "large tortillas"), ingredient(0.5, "cup", "salsa")
    ], ["Cook sausage to 160 F and brown potatoes.", "Scramble eggs until set.", "Fill tortillas with eggs, sausage, potatoes, cheese, and salsa; fold and warm seam-side down."]),
    recipe("Oatmeal with Fruit", 4, "oats", "5 minutes", "8 minutes", "", [
      ingredient(2, "cups", "rolled oats"), ingredient(4, "cups", "milk or water"),
      ingredient(1, "count", "banana"), ingredient(1, "cup", "berries"),
      ingredient(2, "tbsp", "brown sugar"), ingredient(0.5, "tsp", "cinnamon")
    ], ["Bring milk or water to a gentle boil.", "Stir in oats and simmer until creamy.", "Serve with sliced banana, berries, brown sugar, and cinnamon."]),
    recipe("Creamy Mashed Potatoes", 6, "potato", "15 minutes", "25 minutes", "", [
      ingredient(3, "lb", "potatoes"), ingredient(0.5, "cup", "butter"),
      ingredient(0.75, "cup", "milk"), ingredient(1, "tsp", "salt"),
      ingredient(0.25, "tsp", "black pepper"), ingredient(0.5, "tsp", "garlic powder")
    ], ["Peel and cube potatoes and boil until fork tender.", "Drain well and mash with butter.", "Add warm milk and seasonings and mash until smooth."]),
    recipe("Roasted Mixed Vegetables", 6, "bell_pepper", "15 minutes", "30 minutes", "425 F", [
      ingredient(6, "cups", "mixed vegetables"), ingredient(3, "tbsp", "olive oil"),
      ingredient(1, "tsp", "garlic powder"), ingredient(1, "tsp", "Italian seasoning"),
      ingredient(0.75, "tsp", "salt"), ingredient(0.25, "tsp", "black pepper")
    ], ["Heat oven to 425 F.", "Cut vegetables into similar-size pieces and toss with oil and seasonings.", "Spread on a sheet pan and roast until browned and tender."]),
    recipe("Green Bean Casserole", 8, "green_beans", "10 minutes", "30 minutes", "350 F", [
      ingredient(4, "cans", "green beans"), ingredient(2, "cans", "cream of mushroom soup"),
      ingredient(1, "cup", "milk"), ingredient(1, "tsp", "soy sauce"),
      ingredient(2, "cups", "crispy fried onions"), ingredient(0.25, "tsp", "black pepper")
    ], ["Heat oven to 350 F.", "Mix beans, soup, milk, soy sauce, pepper, and half the onions.", "Bake 25 minutes, top with remaining onions, and bake 5 minutes more."]),
    recipe("Simple Coleslaw", 8, "cabbage", "15 minutes", "0 minutes", "", [
      ingredient(1, "head", "cabbage"), ingredient(2, "count", "carrots"),
      ingredient(0.75, "cup", "mayonnaise"), ingredient(2, "tbsp", "apple cider vinegar"),
      ingredient(1, "tbsp", "sugar"), ingredient(0.5, "tsp", "salt")
    ], ["Shred cabbage and carrots.", "Whisk mayonnaise, vinegar, sugar, and salt.", "Toss together and chill at least 30 minutes."]),
    recipe("Skillet Cornbread", 8, "cornmeal", "10 minutes", "22 minutes", "400 F", [
      ingredient(1, "cup", "cornmeal"), ingredient(1, "cup", "all-purpose flour"),
      ingredient(1, "tbsp", "baking powder"), ingredient(1, "count", "egg"),
      ingredient(1, "cup", "milk"), ingredient(0.25, "cup", "melted butter")
    ], ["Heat oven to 400 F and grease a skillet.", "Mix dry ingredients, then stir in egg, milk, and butter just until combined.", "Bake until golden and a toothpick comes out clean."]),
    recipe("Garlic Bread", 8, "bread", "10 minutes", "12 minutes", "375 F", [
      ingredient(1, "loaf", "French bread"), ingredient(0.5, "cup", "butter"),
      ingredient(3, "cloves", "garlic"), ingredient(2, "tbsp", "parsley"),
      ingredient(0.25, "cup", "parmesan"), ingredient(0.25, "tsp", "salt")
    ], ["Heat oven to 375 F.", "Mix softened butter, garlic, parsley, parmesan, and salt.", "Spread over split bread and bake until crisp at the edges."]),
    recipe("Rice Pilaf", 6, "rice", "10 minutes", "25 minutes", "", [
      ingredient(1.5, "cups", "long grain rice"), ingredient(3, "cups", "chicken broth"),
      ingredient(0.5, "count", "onion"), ingredient(2, "tbsp", "butter"),
      ingredient(0.5, "cup", "orzo"), ingredient(2, "tbsp", "parsley")
    ], ["Cook onion, rice, and orzo in butter until lightly toasted.", "Add broth, cover, and simmer on low until liquid is absorbed.", "Rest 5 minutes, fluff, and add parsley."]),
    recipe("Homestyle Baked Beans", 8, "baked_beans", "10 minutes", "45 minutes", "350 F", [
      ingredient(4, "cans", "baked beans"), ingredient(6, "slices", "bacon"),
      ingredient(0.5, "count", "onion"), ingredient(0.25, "cup", "brown sugar"),
      ingredient(2, "tbsp", "ketchup"), ingredient(1, "tbsp", "mustard")
    ], ["Heat oven to 350 F and cook bacon until partly crisp.", "Mix beans, onion, brown sugar, ketchup, mustard, and chopped bacon.", "Bake uncovered until bubbling and thickened."])
  ];
})(typeof globalThis !== "undefined" ? globalThis : this);
