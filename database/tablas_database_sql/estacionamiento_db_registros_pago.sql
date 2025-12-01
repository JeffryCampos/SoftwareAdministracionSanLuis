-- MySQL dump 10.13  Distrib 8.0.36, for Win64 (x86_64)
--
-- Host: localhost    Database: estacionamiento_db
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'd752da64-bbea-11f0-8d70-ae3e5931702b:1-224';

--
-- Table structure for table `registros_pago`
--

DROP TABLE IF EXISTS `registros_pago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registros_pago` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_contrato` int NOT NULL,
  `periodo` date NOT NULL,
  `fecha_pago` datetime DEFAULT NULL,
  `monto_esperado` decimal(10,2) NOT NULL,
  `monto_multa` decimal(10,2) NOT NULL DEFAULT '0.00',
  `estado` varchar(15) NOT NULL,
  `monto_pagado` decimal(10,2) DEFAULT NULL,
  `observaciones` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_contrato_periodo` (`id_contrato`,`periodo`),
  CONSTRAINT `registros_pago_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contratos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=322 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registros_pago`
--

LOCK TABLES `registros_pago` WRITE;
/*!40000 ALTER TABLE `registros_pago` DISABLE KEYS */;
INSERT INTO `registros_pago` VALUES (304,92,'2025-11-01','2025-11-30 23:15:28',30000.00,0.00,'Pagado',30000.00,'Pago de arriendo mensual.'),(305,91,'2024-10-01','2025-11-30 23:23:02',85000.00,257686.00,'Pagado',342686.00,'Pago de arriendo mensual.\nPago de 13 multa(s) por atraso.'),(306,91,'2024-11-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(307,91,'2024-12-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(308,91,'2025-01-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(309,91,'2025-02-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(310,91,'2025-03-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(311,91,'2025-04-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(312,91,'2025-05-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(313,91,'2025-06-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(314,91,'2025-07-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(315,91,'2025-08-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(316,91,'2025-09-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(317,91,'2025-10-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(318,91,'2025-11-01','2025-11-30 23:23:02',85000.00,0.00,'Pagado',85000.00,'Pago de arriendo mensual.'),(320,92,'2025-12-01','2025-12-01 20:42:59',30000.00,0.00,'Pagado',30000.00,'Pago de arriendo mensual.');
/*!40000 ALTER TABLE `registros_pago` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-01 19:16:32
