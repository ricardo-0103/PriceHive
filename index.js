import bodyParser from "body-parser";
import express from "express";
import { chromium } from "playwright";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post("/product", async (req, res) => {
  const productName = req.body.product;
  //const productsMercadoLibre = await searchProductMercadoLibre(productName);
  const productsAlkosto = await searchProductAlkosto(productName);
  //const productsOlimpica = await searchProductOlimpica(productName);
  //const productsExito = await searchProductExito(productName);
  res.render("index.ejs", { products: productsAlkosto });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const searchProductMercadoLibre = async (product) => {
  console.log("inicio");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.mercadolibre.com.co/");
  await page.waitForLoadState("domcontentloaded");
  await page.click("#cb1-edit");
  //Write the product in the search bar
  await page.$eval(
    "#cb1-edit",
    (element, product) => {
      element.value = product;
    },
    product
  );
  //Search the product
  await page.click(".nav-search-btn");
  await page.waitForLoadState("domcontentloaded");

  //Order the products by price REVIEW:
  await page.waitForSelector(".andes-dropdown__trigger");
  await page.click(".andes-dropdown__trigger");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".andes-card__content");

  // Click on the second child of the ul element
  await page.click(
    ".andes-list.andes-floating-menu.andes-list--default.andes-list--selectable > :nth-child(2)"
  );
  await page.waitForLoadState("domcontentloaded");

  //Get the price of the first 3 products
  await page.waitForSelector(".price");
  const prices = await page.$$eval(
    ".andes-money-amount.ui-search-price__part.ui-search-price__part--medium.andes-money-amount--cents-superscript",
    (el_prices) =>
      el_prices.slice(0, 3).map((el_price) => {
        // Get the second child element (index 1)
        const priceElement = el_price.children[1];
        // Return the text content of the price element
        return priceElement.textContent.trim();
      })
  );

  //Get the name of the first 3 products
  await page.waitForSelector(".ui-search-item__title");
  const productsName = await page.$$eval(".ui-search-item__title", (el_names) =>
    el_names.slice(0, 3).map((el_name) => {
      return el_name.textContent.trim();
    })
  );

  //Get the link of the img of the first 3 products
  await page.waitForSelector(".ui-search-result-image__element");
  const productsImg = await page.$$eval(
    ".ui-search-result-image__element",
    (el_imgs) =>
      el_imgs.slice(0, 3).map((el_img) => {
        return el_img.src;
      })
  );

  //Get the description of the first 3 products
  const numberOfProducts = prices.length;
  const productsDescription = [];
  const productsLink = [];

  for (let i = 0; i < numberOfProducts; i++) {
    await page.waitForSelector(".ui-search-result-image__element");
    const productElements = await page.$$(".ui-search-item__title");
    // Click on the product title to view its description
    await productElements[i].click();
    await page.waitForLoadState("domcontentloaded");

    // Extract the descriptions of the product
    const prodDesc_i = await page.$$eval(
      ".ui-vpp-highlighted-specs__features-list li", // Targeting individual list items (li elements)
      (listItems) => {
        // Map over each list item and return its text content with newline characters
        return listItems.map((item) => {
          return item.textContent.trim();
        });
      }
    );
    productsDescription.push(prodDesc_i);

    // Get the link of the first 3 products, in case the user wants to buy one of them
    productsLink.push(page.url());

    // Navigate back to the previous page
    await page.goBack();
  }

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  //await page.screenshot({ path: "ssMercadoLibre.png" });
  console.log("listo");
  await browser.close();

  //Create the JSON object of the products
  const products = [];
  for (let i = 0; i < numberOfProducts; i++) {
    products.push({
      name: productsName[i],
      price: prices[i],
      img: productsImg[i],
      description: productsDescription[i],
      link: productsLink[i],
    });
  }

  return products;
};

const searchProductAlkosto = async (product) => {
  console.log("inicio");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.alkosto.com.co/");
  await page.waitForLoadState("domcontentloaded");

  // Write the product in the search bar
  await page.click("#js-site-search-input");
  await page.$eval(
    "#js-site-search-input",
    (element, product) => {
      element.value = product;
    },
    product
  );
  // Simulate pressing the "Enter" key to search for the product
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "ssAlkosto.png" });

  await page.waitForSelector(
    ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click"
  );
  //Get the name of the first 5 products
  const productsName = await page.$$eval(
    ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click",
    (el_names) =>
      el_names.slice(0, 5).map((el_name) => {
        return el_name.children[0].children[0].textContent.trim();
      })
  );

  const numberOfProducts = productsName.length;

  //Get the img of the first 5 products
  const productsImg = await page.$$eval(
    ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click",
    (el_names) =>
      el_names.slice(0, 5).map((el_name) => {
        return el_name.children[1].children[0].children[0].src;
      })
  );

  //Get the description, the links of the products and their prices
  const productsLink = [];
  const productsDescription = [];
  const prices = [];
  for (let i = 0; i < numberOfProducts; i++) {
    await page.waitForSelector(
      ".product__item__information__key-features.js-key-features"
    );
    const productElements = await page.$$(
      ".js-view-details.js-algolia-product-click"
    );

    await productElements[i].click();
    await page.waitForLoadState("domcontentloaded");

    // Extract the descriptions of the product
    const prodDesc_i = await page.$$eval(
      ".tab-details__keyFeatures--list li", // Targeting individual list items (li elements)
      (listItems) => {
        // Map over each list item and return its text content with newline characters
        return listItems.map((item) => {
          return item.textContent.trim();
        });
      }
    );
    productsDescription.push(prodDesc_i);

    // Extract the price of the product
    const price_i = await page.$eval("#js-original_price", (priceElem) => {
      return priceElem.textContent.trim().split(" ")[0];
    });
    prices.push(price_i);

    // Get the link of the products, in case the user wants to buy one of them
    productsLink.push(page.url());

    // Navigate back to the previous page
    await page.goBack();
  }

  await page.waitForLoadState("domcontentloaded");
  console.log("fin");

  await browser.close();

  //Create the JSON object of the products
  const products = createJSONObject(
    productsName,
    prices,
    productsImg,
    productsDescription,
    productsLink,
    numberOfProducts
  );

  return products;
};
const searchProductOlimpica = async (product) => {
  console.log("inicio");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.olimpica.com/");
  await page.waitForLoadState("domcontentloaded");

  // Write the product in the search bar
  await page.click("#downshift-0-input");
  await page.$eval(
    "#downshift-0-input",
    (element, product) => {
      element.value = product;
    },
    product
  );

  // Simulate pressing the "Enter" key to search for the product
  await page.keyboard.press("Enter");
  await page.waitForLoadState("domcontentloaded");

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  await page.screenshot({ path: "ssOlimpica.png" });

  await browser.close();
  console.log("fin");
  return [];
};

const searchProductExito = async (product) => {
  console.log("inicio Exito");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.exito.com/");
  await page.waitForLoadState("domcontentloaded");

  // Write the product in the search bar
  await page.click("[data-testid='store-input']");
  await page.$eval(
    "[data-testid='store-input']",
    (element, product) => {
      element.value = product;
    },
    product
  );
  // Simulate pressing the Enter key
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");

  // Order the products by price
  /*await page.waitForSelector("[data-testid='store-dropdown-button']");
  await page.click("[data-testid='store-dropdown-button']");
  await page.waitForLoadState("domcontentloaded");*/

  //Get the name of the first 3 products
  const productsName = await page.$$eval(
    "[data-testid='store-product-card-content']",
    (el_names) =>
      el_names.slice(0, 3).map((el_name) => {
        return el_name.children[0].children[0].children[1].children[0].textContent.trim();
      })
  );
  console.log(productsName);

  //Get the price of the first 3 products
  const prices = await page.$$eval(
    ".ProductPrice_container__price__XmMWA",
    (el_prices) =>
      el_prices.slice(0, 3).map((el_price) => {
        return el_price.textContent.trim().split(" ")[1];
      })
  );
  console.log(prices);

  //Get the link of the first 3 products
  const productsLink = await page.$$eval(
    "[data-testid='store-product-card-image']",
    (el_links) =>
      el_links.slice(0, 3).map((el_link) => {
        return el_link.children[0].href;
      })
  );
  console.log(productsLink);

  //Get the imgs of the first 3 products
  const productsImg = await page.$$eval(
    "[data-testid='store-product-card-image']",
    (el_imgs) =>
      el_imgs.slice(0, 3).map((el_img) => {
        return el_img.children[0].children[0].src;
      })
  );
  console.log(productsImg);

  //Get the description of the first 3 products
  const productsDescription = [];

  /*for (let i = 0; i < productsImg.length; i++) {
    await page.waitForSelector("[data-testid='product-link']");
    const productElements = await page.$$("[data-testid='product-link']");

    await productElements[i].click();
    await page.waitForLoadState("domcontentloaded");

    await page.waitForSelector(".flix-media_flix-media-content__Wl6M8");
    const prodDesc_i = await page.$eval(
      ".product-description_fs-product-description-content__HPsDQ",
      (el_desc) =>
        el_desc.children[0].children[0].children[0].children[0].textContent.trim()
    );
    productsDescription.push(prodDesc_i);
    // Navigate back to the previous page
    await page.goBack();
  }
  console.log(productsDescription);*/

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  await page.screenshot({ path: "ssExito.png" });

  await browser.close();
  console.log("Fin Exito");
  return [];
};

const createJSONObject = (
  productsName,
  prices,
  productsImg,
  productsDescription,
  productsLink,
  numberOfProducts
) => {
  const products = [];
  for (let i = 0; i < numberOfProducts; i++) {
    products.push({
      name: productsName[i],
      price: prices[i],
      img: productsImg[i],
      description: productsDescription[i],
      link: productsLink[i],
    });
  }

  products.sort((a, b) => {
    // Extract the numeric values of prices
    const priceA = parseFloat(
      a.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
    );
    const priceB = parseFloat(
      b.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
    );

    // Compare the prices
    return priceA - priceB;
  });

  // Filter out products whose names include the word 'case'
  const filteredProducts = products.filter(
    (product) => !product.name.toLowerCase().includes("case")
  );

  //Get the first 3 products
  return filteredProducts.slice(0, 3);
};
