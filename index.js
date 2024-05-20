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

let products;
app.post("/product", async (req, res) => {
  products = [];
  const productName = req.body.product;

  const [productsMercadoLibre, productsAlkosto, productsExito] =
    await Promise.all([
      searchProductMercadoLibre(productName),
      searchProductAlkosto(productName),
      searchProductExito(productName),
    ]);

  products.push(...productsMercadoLibre);
  products.push(...productsAlkosto);
  products.push(...productsExito);

  //const productsOlimpica = await searchProductOlimpica(productName);
  //const productsExito = await searchProductExito(productName);
  res.redirect("/products?page=1");
});

let sortBy = "shop"; // Default sort by shop
app.get("/products", (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = 5;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  sortBy = req.query.sortBy || sortBy;
  const sortedProducts = orderProducts(products, sortBy);

  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  res.render("index.ejs", {
    products: paginatedProducts,
    currentPage: page,
    totalPages: Math.ceil(products.length / pageSize),
    sortBy,
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const searchProductMercadoLibre = async (product) => {
  console.log("inicio Mercado Libre");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.mercadolibre.com.co/");
  await page.waitForLoadState("domcontentloaded");

  //Write the product in the search bar
  await page.click("#cb1-edit");
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

  //Get the price of the first 5 products
  await page.waitForSelector(
    ".andes-money-amount.ui-search-price__part.ui-search-price__part--medium.andes-money-amount--cents-superscript"
  );
  const prices = await page.$$eval(
    ".andes-money-amount.ui-search-price__part.ui-search-price__part--medium.andes-money-amount--cents-superscript",
    (el_prices) =>
      el_prices.slice(0, 5).map((el_price) => {
        // Get the second child element (index 1)
        const priceElement = el_price.children[1];
        // Return the text content of the price element
        return priceElement.textContent.trim();
      })
  );

  //Get the name of the first 5 products
  await page.waitForSelector(".ui-search-item__title");
  const productsName = await page.$$eval(".ui-search-item__title", (el_names) =>
    el_names.slice(0, 5).map((el_name) => {
      return el_name.textContent.trim();
    })
  );

  //Get the link of the img of the first 5 products
  await page.waitForSelector(".ui-search-result-image__element");
  const productsImg = await page.$$eval(
    ".ui-search-result-image__element",
    (el_imgs) =>
      el_imgs.slice(0, 5).map((el_img) => {
        return el_img.src;
      })
  );

  //Get the description of the first 5 products
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

    //Some products don't have the description where it should be, so we need to look for it below the product
    if (prodDesc_i.length != 0) {
      productsDescription.push(prodDesc_i);
    } else {
      const prodDesc = await page.$eval(
        ".ui-pdp-description__content",
        (desc) => {
          return desc.textContent.trim();
        }
      );

      productsDescription.push([prodDesc.slice(0, 300) + "..."]);
    }

    // Get the link of the first 3 products, in case the user wants to buy one of them
    productsLink.push(page.url());

    // Navigate back to the previous page
    await page.goBack();
  }

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  //await page.screenshot({ path: "ssMercadoLibre.png" });
  console.log("fin Mercado Libre");
  await browser.close();

  //Create the JSON object of the products
  const products = createJSONObject(
    "Mercado Libre",
    productsName,
    prices,
    productsImg,
    productsDescription,
    productsLink,
    numberOfProducts
  );

  return products;
};

const searchProductAlkosto = async (product) => {
  console.log("inicio Alkosto");
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
  // await page.waitForLoadState("networkidle");
  // await page.screenshot({ path: "ssAlkosto.png" });

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
    // Wait for the selector
    await page.waitForSelector(
      ".product__item__top__title.js-algolia-product-click.js-algolia-product-title"
    );

    // Get the data-url attribute of the element
    const productUrls = await page.$$eval(
      ".product__item__top__title.js-algolia-product-click.js-algolia-product-title",
      (elements) => elements.map((el) => el.getAttribute("data-url"))
    );
    await page.goto(`https://www.alkosto.com.co${productUrls[i]}`);
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({ path: `ssAlkosto.png` });

    await page.waitForSelector(".tab-details__keyFeatures--list");
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
  console.log("fin Alkosto");

  await browser.close();

  //Create the JSON object of the products
  const products = createJSONObject(
    "Alkosto",
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
  //await page.waitForLoadState("networkidle");

  await page.waitForSelector("[data-testid='store-product-card-content']");
  const productsName = [];
  const prices = [];
  const productsImg = [];
  const productsLink = [];
  const productsDescription = [];

  //Get the elements that have the information of the product
  const numberOfElements = await page.$$(
    "[data-testid='store-product-card-content']"
  );

  for (let i = 0; i < numberOfElements.length; i++) {
    await page.waitForSelector(".ProductPrice_container__price__XmMWA");
    //Get the elements that have the information of the product
    const elementsName_Link = await page.$$(
      "[data-testid='store-product-card-content']"
    );
    const elementsPrice = await page.$$(
      ".ProductPrice_container__price__XmMWA"
    );
    const elementsImg = await page.$$(".imagen_plp");

    //Get the title of the product
    const title = await elementsName_Link[i].evaluate((tit) =>
      tit.children[0].children[0].children[1].children[0].textContent.trim()
    );

    //Check if the title of the element includes the product the user wants
    if (verifyNameProduct(product, title)) {
      productsName.push(title);

      //Get the link
      const link = await elementsName_Link[i].evaluate(
        (link) => link.children[0].children[0].children[1].children[0].href
      );
      productsLink.push(link);

      //Get the price
      const price = await elementsPrice[i].evaluate((price) =>
        price.textContent.trim()
      );
      prices.push(price);

      //Get the img src
      const src = await elementsImg[i].evaluate((img) => img.src);
      productsImg.push(src);

      //Get the description
      await page.goto(link);
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("#product-details-content-panel--0");
      // Get the specifications and push them into an array
      const specifications = await page.evaluate(() => {
        const specElements = document.querySelectorAll(
          '.product-specifications_fs-product-details-content__upn_w [data-fs-content-specification="true"] div'
        );
        const specsArray = [];

        specElements.forEach((specElement) => {
          const title = specElement
            .querySelector('[data-fs-title-specification="true"]')
            .textContent.trim();
          const text = specElement
            .querySelector('[data-fs-text-specification="true"]')
            .textContent.trim();
          specsArray.push(`${title}: ${text}`);
        });

        return specsArray;
      });
      productsDescription.push(specifications);

      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
    }

    //Get only the first 5 products
    if (productsName.length === 5) {
      break;
    }
  }

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  await page.screenshot({ path: "ssExito.png" });

  await browser.close();
  console.log("Fin Exito");

  //Create the JSON object of the products
  const products = createJSONObject(
    "Exito",
    productsName,
    prices,
    productsImg,
    productsDescription,
    productsLink,
    productsName.length
  );
  return products;
};

const createJSONObject = (
  shopName,
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
      shop: shopName,
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

  //Get the first 3 products
  return products.slice(0, 3);
};

const verifyNameProduct = (product, title) => {
  const words = product.split(" ");
  for (const word of words) {
    if (!title.toLowerCase().includes(word.toLowerCase())) {
      return false;
    }
  }

  return !title.toLowerCase().includes("case");
};

const orderProducts = (products, sortBy) => {
  let tempProducts = [...products];
  switch (sortBy) {
    case "lowPrice":
      tempProducts.sort((a, b) => {
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
      break;
    case "highPrice":
      tempProducts.sort((a, b) => {
        // Extract the numeric values of prices
        const priceA = parseFloat(
          a.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );
        const priceB = parseFloat(
          b.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );

        // Compare the prices
        return priceB - priceA;
      });
      break;
    default:
      break;
  }
  return tempProducts;
};
